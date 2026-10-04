require('dotenv').config();
const crypto = require('crypto');
require('express-async-errors');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { WORKSPACES, LEVELS, getQuestions } = require('./workspaces');

const PORTAL_ID = String(process.env.PORTAL_ID || 'kazi-kenya').trim().toLowerCase();
const PORTAL_USER_COLLECTION = `${PORTAL_ID.replace(/[^a-z0-9_]/g, '_')}_users`;
const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), "style-src": ["'self'", "https://fonts.googleapis.com"], "style-src-attr": ["'unsafe-inline'"], "font-src": ["'self'", "https://fonts.gstatic.com", "data:"], "connect-src": ["'self'", "https://api.hashback.co.ke"] } } }));
app.use('/api/payments/callback', express.raw({ type: 'application/json', limit: '32kb' }));
app.use(express.json({ limit: '20kb' }));
app.use(express.static('public'));

function makeTransactionCode() { const d = new Date(), day = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`; return `KYT-${day}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`; }
const paymentAccountId = () => process.env.PAYMENT_ACCOUNT_ID || process.env['HASH'+'PAY_ACCOUNT_ID'] || '';
const paymentApiKey = () => process.env.PAYMENT_API_KEY || process.env['HASH'+'PAY_API_KEY'] || '';
const paymentWebhookSecret = () => process.env.PAYMENT_WEBHOOK_SECRET || process.env['HASH'+'PAY_WEBHOOK_SECRET'] || '';
const paymentSecurityCredential = () => process.env.PAYMENT_SECURITY_CREDENTIAL || process.env['HASH'+'PAY_SECURITY_CREDENTIAL'] || '';
const userSchema = new mongoose.Schema({ portalId: { type: String, required: true, default: PORTAL_ID }, name: { type: String, required: true, trim: true, maxlength: 80 }, username: { type: String, lowercase: true, trim: true }, email: { type: String, required: true, lowercase: true, trim: true }, phone: { type: String, required: true }, password: { type: String, required: true }, walletBalance: { type: Number, default: 0 }, reservedBalance: { type: Number, default: 0 }, readyToWithdraw: { type: Number, default: 0 }, skillPoints: { type: Number, default: 0 }, unlockPoints: { type: Number, default: 0 }, walletModelVersion: { type: Number, default: 0 }, createdAt: { type: Date, default: Date.now } });
userSchema.index({ portalId: 1, email: 1 }, { unique: true, name: 'portal_email_unique' });
userSchema.index({ portalId: 1, username: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } }, name: 'portal_username_unique' });
const User = mongoose.model('User', userSchema, PORTAL_USER_COLLECTION);
const LegacySharedUser = mongoose.model('LegacySharedUser', new mongoose.Schema({}, { strict: false, versionKey: false }), 'users');
const depositSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, reference: { type: String, required: true, unique: true }, transactionCode: { type: String, unique: true, sparse: true }, amount: { type: Number, required: true }, phone: { type: String, required: true }, status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' }, checkoutId: String, createdAt: { type: Date, default: Date.now } });
const Deposit = mongoose.model('Deposit', depositSchema);
const levelUnlockPaymentSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, workspace: { type: String, required: true }, level: { type: Number, required: true }, reference: { type: String, required: true, unique: true }, transactionCode: { type: String, unique: true, sparse: true }, amount: { type: Number, default: 30 }, phone: { type: String, required: true }, status: { type: String, enum: ['pending','paid','failed'], default: 'pending' }, checkoutId: String, createdAt: { type: Date, default: Date.now } });
const LevelUnlockPayment = mongoose.model('LevelUnlockPayment', levelUnlockPaymentSchema);
const withdrawalSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, transactionCode: { type: String, unique: true, sparse: true }, amount: { type: Number, required: true }, phone: { type: String, required: true }, status: { type: String, enum: ['pending', 'processing', 'paid', 'failed'], default: 'pending' }, createdAt: { type: Date, default: Date.now } });
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
const entrySchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, type: { type: String, enum: ['deposit', 'earning', 'withdrawal', 'adjustment'], required: true }, transactionCode: { type: String, unique: true, sparse: true }, amount: { type: Number, required: true }, direction: { type: String, enum: ['credit', 'debit'] }, reference: { type: String, required: true, unique: true }, note: String, createdAt: { type: Date, default: Date.now } });
const Entry = mongoose.model('Entry', entrySchema);
const transactionCodeSchema = new mongoose.Schema({ code: { type: String, unique: true, required: true }, createdAt: { type: Date, default: Date.now } });
const TransactionCode = mongoose.model('TransactionCode', transactionCodeSchema);
const workEarningSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, skillPoints: { type: Number, required: true }, amount: { type: Number, required: true }, status: { type: String, enum: ['pending', 'available'], default: 'pending', index: true }, reference: { type: String, required: true, unique: true }, verifiedAt: { type: Date, default: Date.now }, availableAt: Date });
const WorkEarning = mongoose.model('WorkEarning', workEarningSchema);
async function reserveTransactionCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeTransactionCode();
    try { await TransactionCode.create({ code }); return code; }
    catch (error) { if (error.code !== 11000) throw error; }
  }
  throw new Error('Could not allocate a unique transaction code. Try again.');
}
async function backfillTransactionCodes() {
  const portalUserIds = await User.find({ portalId: PORTAL_ID }).distinct('_id');
  for (const deposit of await Deposit.find({ userId: { $in: portalUserIds }, transactionCode: { $exists: false } }).select('_id reference').lean()) {
    const code = await reserveTransactionCode();
    await Deposit.updateOne({ _id: deposit._id, transactionCode: { $exists: false } }, { $set: { transactionCode: code } });
    const saved = await Deposit.findById(deposit._id).select('transactionCode').lean();
    if (saved?.transactionCode) await Entry.updateOne({ reference: `dep:${deposit.reference}`, transactionCode: { $exists: false } }, { $set: { transactionCode: saved.transactionCode } });
  }
  for (const withdrawal of await Withdrawal.find({ userId: { $in: portalUserIds }, transactionCode: { $exists: false } }).select('_id').lean()) {
    const code = await reserveTransactionCode();
    await Withdrawal.updateOne({ _id: withdrawal._id, transactionCode: { $exists: false } }, { $set: { transactionCode: code } });
    const saved = await Withdrawal.findById(withdrawal._id).select('transactionCode').lean();
    if (saved?.transactionCode) await Entry.updateOne({ reference: `wd:${withdrawal._id}`, transactionCode: { $exists: false } }, { $set: { transactionCode: saved.transactionCode } });
  }
  for (const entry of await Entry.find({ userId: { $in: portalUserIds }, transactionCode: { $exists: false } }).select('_id').lean()) {
    await Entry.updateOne({ _id: entry._id, transactionCode: { $exists: false } }, { $set: { transactionCode: await reserveTransactionCode() } });
  }
}
async function preparePortalUsers() {
  let indexes = [];
  try { indexes = await User.collection.indexes(); } catch (error) { if (error.codeName !== 'NamespaceNotFound' && error.code !== 26) throw error; }
  for (const index of indexes) {
    const keys = Object.keys(index.key || {});
    if (index.unique && keys.length === 1 && ['email', 'username'].includes(keys[0])) await User.collection.dropIndex(index.name);
  }
  await User.collection.createIndex({ portalId: 1, email: 1 }, { unique: true, name: 'portal_email_unique' });
  await User.collection.createIndex({ portalId: 1, username: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } }, name: 'portal_username_unique' });

  // Copy only legacy accounts with Kazi-specific transaction evidence into this portal's collection.
  const kaziCodeEntries = await Entry.distinct('userId', { transactionCode: /^KYT-/ });
  const kaziCodeWithdrawals = await Withdrawal.distinct('userId', { transactionCode: /^KYT-/ });
  const kaziReferenceDeposits = await Deposit.distinct('userId', { reference: /^KK-/ });
  const legacyIds = [...new Set([...kaziCodeEntries, ...kaziCodeWithdrawals, ...kaziReferenceDeposits].map(String))];
  if (legacyIds.length) {
    const legacyAccounts = await LegacySharedUser.find({ _id: { $in: legacyIds } }).lean();
    for (const account of legacyAccounts) {
      const copy = { ...account, portalId: PORTAL_ID };
      delete copy._id;
      delete copy.__v;
      try { await User.collection.updateOne({ _id: account._id }, { $setOnInsert: copy }, { upsert: true }); }
      catch (error) { if (error.code !== 11000) throw error; }
    }
  }
  for (const [field, value] of [['walletBalance', 0], ['reservedBalance', 0], ['readyToWithdraw', 0], ['skillPoints', 0], ['unlockPoints', 0], ['walletModelVersion', 0]]) {
    await User.updateMany({ portalId: PORTAL_ID, [field]: { $exists: false } }, { $set: { [field]: value } });
  }
  // Convert the old mixed deposit/work balance once: unused deposit funds become
  // level points; only verified-work money remains in the withdrawable wallet.
  for (const member of await User.find({ portalId: PORTAL_ID, walletModelVersion: { $lt: 2 } }).select('_id walletBalance reservedBalance readyToWithdraw unlockPoints').lean()) {
    const [paidDeposits, adminDeposits, withdrawals] = await Promise.all([
      Deposit.aggregate([{ $match: { userId: member._id, status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Entry.aggregate([{ $match: { userId: member._id, type: 'deposit', reference: /^admin-deposit:/ } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Entry.aggregate([{ $match: { userId: member._id, type: 'withdrawal' } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    ]);
    const deposits = (paidDeposits[0]?.total || 0) + (adminDeposits[0]?.total || 0);
    const spentFromDeposit = Math.min(deposits, withdrawals[0]?.total || 0);
    const remainingDeposit = deposits - spentFromDeposit;
    const earningsBalance = Math.max(0, Number(member.walletBalance || 0) - remainingDeposit);
    await User.updateOne({ _id: member._id, portalId: PORTAL_ID, walletModelVersion: { $lt: 2 } }, { $set: { walletBalance: earningsBalance, readyToWithdraw: Math.min(Number(member.readyToWithdraw || 0), earningsBalance), unlockPoints: Number(member.unlockPoints || 0) + deposits / 2, walletModelVersion: 2 } });
  }
}
const progressSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, workspace: { type: String, required: true }, levels: { type: [{ level: Number, unlocked: { type: Boolean, default: false }, unlockCost: Number, unlockedAt: Date, completed: Boolean, score: Number, points: Number, completedAt: Date }], default: [] }, updatedAt: { type: Date, default: Date.now } });
progressSchema.index({ userId: 1, workspace: 1 }, { unique: true });
const Progress = mongoose.model('Progress', progressSchema);
const attemptSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, workspace: { type: String, required: true }, level: { type: Number, required: true }, answers: [{ questionId: String, correctChoice: Number, choices: [String], selectedChoice: Number, correct: Boolean, points: { type: Number, default: 0 } }], usedAt: Date, expiresAt: { type: Date, expires: 0 } });
const QuestionAttempt = mongoose.model('QuestionAttempt', attemptSchema);
const quizSettingsSchema = new mongoose.Schema({ key: { type: String, unique: true, default: 'main' }, skillPointsPerCorrect: { type: Number, default: 20 }, difficultyMultipliers: { type: [Number], default: [1, 1.25, 1.5, 1.75, 2, 2.5] }, updatedAt: { type: Date, default: Date.now } });
const QuizSettings = mongoose.model('QuizSettings', quizSettingsSchema);

const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const configuredAdminEmail = () => String(process.env.ADMIN_EMAIL || 'Kiokok614@gmail.com').trim().toLowerCase();
const adminPortalPath = () => {
  // Keep a valid fallback so a missing Render env var never prevents the service
  // from booting. Admin API access still requires the configured admin login.
  const path = String(process.env.ADMIN_PATH || '/kz-control-7c91e6d204f5b8a14c3d2e60');
  if (!/^\/kz-control-[a-z0-9-]{12,80}$/i.test(path)) return '/kz-control-7c91e6d204f5b8a14c3d2e60';
  return path;
};
function adminAuthorized(req) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const session = jwt.verify(token, process.env.JWT_SECRET);
    return session.role === 'admin' && session.portalId === PORTAL_ID && String(session.email || '').toLowerCase() === configuredAdminEmail();
  } catch { return false; }
}
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); if (req.user.portalId !== PORTAL_ID) return res.status(401).json({ error: 'Please sign in to this Kazi Kenya portal again.' }); next(); }
  catch { res.status(401).json({ error: 'Please sign in to continue.' }); }
}
const emailOk = v => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 200;
const phoneOk = v => /^(?:\+?254|0)(?:7|1)\d{8}$/.test(String(v || '').replace(/[\s-]/g, ''));
const usernameOk = v => typeof v === 'string' && /^[a-zA-Z0-9_]{3,20}$/.test(v);

app.get('/api/health', (_req, res) => { const ok = mongoose.connection.readyState === 1; res.status(ok ? 200 : 503).json({ ok, database: 'mongodb', portal: PORTAL_ID, usersCollection: PORTAL_USER_COLLECTION, build: 'tenant-wallet-isolation-v1' }); });
app.post('/api/auth/register', authLimit, async (req, res) => {
  const { name, phone, password } = req.body || {}, email = String(req.body?.email || '').trim().toLowerCase();
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 80 || !emailOk(email) || !phoneOk(phone) || typeof password !== 'string' || password.length < 6) return res.status(400).json({ error: 'Enter your name, a valid email, Kenyan M-Pesa number, and password of at least 6 characters.' });
  if (email === configuredAdminEmail()) return res.status(403).json({ error: 'This email is reserved for administrator sign-in.' });
  if (await User.exists({ portalId: PORTAL_ID, email })) return res.status(409).json({ error: 'An account already uses this email on Kazi Kenya. Log in or use a different email.' });
  const usernameBase = name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14) || 'kaziuser';
  const hash = await bcrypt.hash(password, 12);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const user = await User.create({ portalId: PORTAL_ID, name: name.trim(), username: `${usernameBase}_${crypto.randomInt(1000,9999)}`, email, phone: normalizePhone(phone), password: hash, walletModelVersion: 2 });
      return res.status(201).json(issueToken(user));
    } catch (e) {
      if (e.code !== 11000) throw e;
      if (e.keyPattern?.email || await User.exists({ portalId: PORTAL_ID, email })) return res.status(409).json({ error: 'An account already uses this email on Kazi Kenya. Log in or use a different email.' });
      if (!e.keyPattern?.username) throw e;
    }
  }
  res.status(503).json({ error: 'We could not finish creating your account. Please try again.' });
});
app.post('/api/auth/login', authLimit, async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim(), password = req.body?.password;
  if (!emailOk(email) || typeof password !== 'string' || password.length < 6 || password.length > 128) return res.status(400).json({ error: 'Enter a valid email and a password of at least 6 characters.' });
  if (email === configuredAdminEmail()) return res.status(403).json({ error: 'This is the administrator email. Open your private admin portal to sign in.' });
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Sign-in is temporarily unavailable while the member database reconnects. Please try again shortly.' });
  try {
    const user = await User.findOne({ portalId: PORTAL_ID, email });
    if (!user || typeof user.password !== 'string' || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.password)) return res.status(401).json({ error: 'Email or password is incorrect. If this is your account, contact support to restore access.' });
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) return res.status(401).json({ error: 'Email or password is incorrect.' });
    res.json(issueToken(user));
  } catch (error) {
    console.error('Member login could not query MongoDB:', error.name, error.message);
    res.status(503).json({ error: 'Sign-in is temporarily unavailable while the member database reconnects. Please try again shortly.' });
  }
});
function issueToken(user) { return { token: jwt.sign({ id: user.id, name: user.name, email: user.email, portalId: PORTAL_ID }, process.env.JWT_SECRET, { expiresIn: '1h' }), user: { name: user.name, username: user.username, email: user.email } }; }
app.post('/api/auth/refresh', auth, authLimit, async (req,res) => { const user=await User.findOne({ _id:req.user.id, portalId:PORTAL_ID }).select('name username email'); if(!user)return res.status(404).json({error:'Account not found.'}); res.json(issueToken(user)); });
app.get('/api/me', auth, async (req, res) => { const user = await User.findOne({ _id: req.user.id, portalId: PORTAL_ID }).select('name username email phone'); if (!user) return res.status(404).json({ error: 'Account not found.' }); res.json({ user }); });
app.patch('/api/profile', auth, async (req,res) => {
  const name=String(req.body?.name||'').trim(),username=String(req.body?.username||'').trim().toLowerCase();
  if(name.length<2||name.length>80||!usernameOk(username))return res.status(400).json({error:'Enter a name (2–80 characters) and username (3–20 letters, numbers, or underscores).'});
  try{const user=await User.findOneAndUpdate({_id:req.user.id,portalId:PORTAL_ID},{$set:{name,username}},{new:true,runValidators:true}).select('name username email phone');if(!user)return res.status(404).json({error:'Account not found.'});res.json({user})}
  catch(e){if(e.code===11000)return res.status(409).json({error:'That username is already in use.'});throw e}
});
app.patch('/api/profile/password', auth, authLimit, async (req,res) => {
  const current=String(req.body?.currentPassword||''),next=String(req.body?.newPassword||'');
  if(next.length<6||next.length>128)return res.status(400).json({error:'New password must be 6–128 characters.'});
  const user=await User.findOne({_id:req.user.id,portalId:PORTAL_ID});if(!user||!(await bcrypt.compare(current,user.password)))return res.status(400).json({error:'Current password is incorrect.'});
  user.password=await bcrypt.hash(next,12);await user.save();res.json({changed:true,message:'Password updated.'});
});

app.get('/api/workspaces', async (_req, res) => res.json({ workspaces: WORKSPACES, levels: LEVELS }));
const DEFAULT_QUIZ_SETTINGS = { skillPointsPerCorrect: 20, difficultyMultipliers: [1, 1.25, 1.5, 1.75, 2, 2.5] };
async function getQuizSettings(session) {
  let query = QuizSettings.findOne({ key: `${PORTAL_ID}:main` });
  if (session) query = query.session(session);
  const settings = await query.lean();
  return settings || DEFAULT_QUIZ_SETTINGS;
}
app.get('/api/workspaces/progress', auth, async (req, res) => {
  const rows = await Progress.find({ userId: req.user.id }).select('workspace levels updatedAt');
  res.json({ progress: rows });
});
const LEVEL_UNLOCK_COST = 30;
function levelIsUnlocked(progress, level) { const row=progress?.levels?.find(item=>item.level===level); return !!(row?.unlocked || row?.completed); }
async function openPaidLevel(payment){
  const fresh=await LevelUnlockPayment.findById(payment._id).lean();if(!fresh||fresh.status!=='paid')return false;
  let progress=await Progress.findOne({userId:fresh.userId,workspace:fresh.workspace});if(!progress)progress=new Progress({userId:fresh.userId,workspace:fresh.workspace,levels:[]});
  let row=progress.levels.find(item=>item.level===fresh.level);if(row){row.unlocked=true;row.unlockCost=30;row.unlockedAt=row.unlockedAt||new Date()}else progress.levels.push({level:fresh.level,unlocked:true,unlockCost:30,unlockedAt:new Date(),completed:false,score:0,points:0});progress.updatedAt=new Date();await progress.save();return true;
}
async function markUnlockPaid(payment){
  const claimed=await LevelUnlockPayment.findOneAndUpdate({_id:payment._id,status:{$in:['pending','failed']}},{$set:{status:'paid',checkoutId:String(payment.checkoutId||'')}},{new:true});
  if(claimed)return openPaidLevel(claimed);return openPaidLevel(payment);
}
app.post('/api/workspaces/:slug/levels/:level/unlock-payment', auth, async (req,res) => {
  const level=Number(req.params.level),slug=req.params.slug,phone=normalizePhone(req.body?.phone);
  if(!WORKSPACES.some(w=>w.slug===slug)||!Number.isInteger(level)||level<1||level>6)return res.status(404).json({error:'Workspace or level not found.'});
  if(!phoneOk(phone))return res.status(400).json({error:'Enter a valid Kenyan M-Pesa number.'});
  const progress=await Progress.findOne({userId:req.user.id,workspace:slug}).select('levels').lean();if(levelIsUnlocked(progress,level))return res.json({unlocked:true,alreadyUnlocked:true});
  if(!paymentAccountId()||!paymentApiKey()||!paymentWebhookSecret())return res.status(503).json({error:'M-Pesa level unlocks are temporarily unavailable. Please try again later.'});
  const prior=await LevelUnlockPayment.findOne({userId:req.user.id,workspace:slug,level,status:'pending'}).sort({createdAt:-1});if(prior){const age=Date.now()-new Date(prior.createdAt).getTime();if(age<5*60*1000)return res.status(202).json({reference:prior.reference,transactionCode:prior.transactionCode,checkoutId:prior.checkoutId,status:'pending',promptAccepted:!!prior.checkoutId,message:prior.checkoutId?'An M-Pesa request is already active for this level. Check your phone before trying again.':'We could not confirm whether the earlier request reached your phone. Check your phone before trying again.'});await LevelUnlockPayment.updateOne({_id:prior._id,status:'pending'},{$set:{status:'failed'}})}
  const reference='KKU-'+crypto.randomUUID(),transactionCode=await reserveTransactionCode(),order=await LevelUnlockPayment.create({userId:req.user.id,workspace:slug,level,reference,transactionCode,amount:30,phone});
  let response,result;
  try{response=await fetch('https://api.hashback.co.ke/initiatestk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:paymentApiKey(),account_id:paymentAccountId(),amount:'30',msisdn:phone,reference}),signal:AbortSignal.timeout(20000)});result=await response.json().catch(()=>({}));}
  catch(error){console.error('M-Pesa prompt request could not be confirmed:',error.name,error.message);return res.status(202).json({reference,transactionCode,status:'pending',promptAccepted:false,message:'We could not confirm whether the prompt request was accepted. Check your phone before trying again.'})}
  const accepted=response.ok&&result.success===true&&!!(result.checkout_id||result.CheckoutRequestID)&&(!('ResponseCode'in result)||String(result.ResponseCode)==='0');
  if(!accepted){await LevelUnlockPayment.updateOne({_id:order._id,status:'pending'},{$set:{status:'failed'}});const providerMessage=String(result.CustomerMessage||result.message||result.error?.message||'').trim().slice(0,180);return res.status(502).json({error:providerMessage||'The payment request was not accepted. Check the phone number and try again.'})}
  const checkoutId=String(result.checkout_id||result.CheckoutRequestID);await LevelUnlockPayment.updateOne({_id:order._id,status:'pending'},{$set:{checkoutId}});
  res.status(202).json({reference,transactionCode,checkoutId,status:'pending',promptAccepted:true,message:String(result.CustomerMessage||'Payment request accepted. Check your M-Pesa phone and enter your PIN to continue.').slice(0,180)});
});
app.get('/api/levels/unlock-payments/:reference',auth,async(req,res)=>{
 const item=await LevelUnlockPayment.findOne({reference:req.params.reference,userId:req.user.id});if(!item)return res.status(404).json({error:'Level unlock payment not found.'});
 if(item.status==='pending'&&item.checkoutId&&paymentApiKey()&&paymentAccountId()){
   try{const response=await fetch('https://api.hashback.co.ke/transactionstatus',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:paymentApiKey(),account_id:paymentAccountId(),checkoutid:item.checkoutId}),signal:AbortSignal.timeout(10000)});const status=await response.json().catch(()=>({}));if(response.ok&&String(status.ResponseCode)==='0'&&status.ResultCode!==undefined&&status.ResultCode!==null){if(String(status.ResultCode)==='0')await markUnlockPaid(item);else await LevelUnlockPayment.updateOne({_id:item._id,status:'pending'},{$set:{status:'failed'}})}}catch(error){console.warn('Payment status check is temporarily unavailable:',error.name)}
 }
 const current=await LevelUnlockPayment.findById(item._id).select('reference workspace level amount status transactionCode createdAt').lean();res.json({...current,promptAccepted:!!item.checkoutId,message:item.status==='paid'?'Payment confirmed.':item.status==='failed'?'Payment was not completed.':'Payment status is still pending.'});
});
app.get('/api/workspaces/:slug/levels/:level/questions', auth, async (req, res) => {
  const level = Number(req.params.level), questions = getQuestions(req.params.slug, level);
  if (!questions || !Number.isInteger(level) || level < 1 || level > 6) return res.status(404).json({ error: 'Workspace or level not found.' });
  const progress=await Progress.findOne({userId:req.user.id,workspace:req.params.slug}).select('levels').lean();
  if(!levelIsUnlocked(progress,level))return res.status(403).json({error:'Pay KES 30 to unlock this level before starting.'});
  const order = shuffle([...questions]);
  const randomized = order.map(q => { const choices = shuffle(q.choices.map((text,index)=>({text,index}))); return { id:q.id, prompt:q.prompt, choices:choices.map(c=>c.text), correctChoice:choices.findIndex(c=>c.index===q.correct) }; });
  const attempt = await QuestionAttempt.create({ userId:req.user.id, workspace:req.params.slug, level, answers:randomized.map(q=>({questionId:q.id,correctChoice:q.correctChoice,choices:q.choices})), expiresAt:new Date(Date.now()+60*60*1000) });
  const settings = await getQuizSettings();
  res.json({ title: WORKSPACES.find(w=>w.slug===req.params.slug).title, level, attemptId:attempt.id, skillPointsPerCorrect: settings.skillPointsPerCorrect, difficultyMultiplier: settings.difficultyMultipliers[level-1] || 1, questions:randomized.map(({id,prompt,choices})=>({id,prompt,choices})) });
});
app.post('/api/workspaces/:slug/levels/:level/answer',auth,async(req,res)=>{
 const level=Number(req.params.level),{attemptId,questionIndex,choice}=req.body||{};
 if(!Number.isInteger(questionIndex)||questionIndex<0||questionIndex>9||!Number.isInteger(choice)||choice<0||choice>3||!mongoose.isValidObjectId(attemptId))return res.status(400).json({error:'Choose one answer to continue.'});
 const attempt=await QuestionAttempt.findOne({_id:attemptId,userId:req.user.id,workspace:req.params.slug,level,usedAt:null,expiresAt:{$gt:new Date()}});
 if(!attempt||attempt.answers.length!==10)return res.status(409).json({error:'This quiz attempt expired. Unlock this level again to retry.'});
 const row=attempt.answers[questionIndex];if(!row||row.selectedChoice!==undefined)return res.status(409).json({error:'That answer has already been recorded.'});
 const correct=Number(row.correctChoice)===choice,settings=await getQuizSettings(),points=correct?Math.round(settings.skillPointsPerCorrect*(settings.difficultyMultipliers[level-1]||1)):0;
 row.selectedChoice=choice;row.correct=correct;row.points=points;await attempt.save();if(points)await User.updateOne({_id:req.user.id,portalId:PORTAL_ID},{$inc:{skillPoints:points}});
 res.json({correct,correctAnswer:row.choices[row.correctChoice],points,answered:questionIndex+1});
});
app.post('/api/workspaces/:slug/levels/:level/complete',auth,async(req,res)=>{
 const level=Number(req.params.level),attemptId=req.body?.attemptId;if(!getQuestions(req.params.slug,level)||!Number.isInteger(level)||level<1||level>6)return res.status(404).json({error:'Workspace or level not found.'});if(!mongoose.isValidObjectId(attemptId))return res.status(400).json({error:'Quiz attempt not found.'});
 const attempt=await QuestionAttempt.findOneAndUpdate({_id:attemptId,userId:req.user.id,workspace:req.params.slug,level,usedAt:null,expiresAt:{$gt:new Date()}},{$set:{usedAt:new Date()}},{new:true});if(!attempt||attempt.answers.length!==10)return res.status(409).json({error:'This quiz attempt expired or was already submitted.'});if(attempt.answers.some(row=>row.selectedChoice===undefined))return res.status(400).json({error:'Answer all 10 questions before submitting.'});
 const score=attempt.answers.filter(row=>row.correct).length,earnedPoints=attempt.answers.reduce((sum,row)=>sum+Number(row.points||0),0),points=score>=7?Math.max(200,earnedPoints):earnedPoints,bonusPoints=points-earnedPoints;if(bonusPoints>0)await User.updateOne({_id:req.user.id,portalId:PORTAL_ID},{$inc:{skillPoints:bonusPoints}});let progress=await Progress.findOne({userId:req.user.id,workspace:req.params.slug});if(!progress)progress=new Progress({userId:req.user.id,workspace:req.params.slug,levels:[]});let row=progress.levels.find(item=>item.level===level);
 if(score>=7){if(row){row.unlocked=true;row.completed=true;row.score=Math.max(row.score||0,score);row.points=(row.points||0)+points;row.completedAt=row.completedAt||new Date()}else progress.levels.push({level,unlocked:true,completed:true,score,points,completedAt:new Date()})}else if(row){row.unlocked=false;row.completed=false;row.score=score;row.points=(row.points||0)+points;row.completedAt=null}else progress.levels.push({level,unlocked:false,completed:false,score,points,completedAt:null});progress.updatedAt=new Date();await progress.save();const user=await User.findOne({_id:req.user.id,portalId:PORTAL_ID}).select('skillPoints');res.json({score,total:10,passed:score>=7,points,skillPoints:user?.skillPoints||0,completedLevels:progress.levels.filter(item=>item.completed).length,nextLevel:score>=7&&level<6?level+1:null});
});

async function walletSummary(userId) {
  const user = await User.findOne({ _id: userId, portalId: PORTAL_ID }).select('walletBalance reservedBalance readyToWithdraw skillPoints unlockPoints');
  if (!user) throw new Error('Account not found.');
  const [paidDeposits, adminDeposits, earnings, verifiedPoints, pendingEarnings, verifiedWork] = await Promise.all([
    Deposit.aggregate([{ $match: { userId: user._id, status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Entry.aggregate([{ $match: { userId: user._id, type: 'deposit', reference: /^admin-deposit:/ } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Entry.aggregate([{ $match: { userId: user._id, type: 'earning', reference: { $not: /^work-earning:/ } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    WorkEarning.aggregate([{ $match: { userId: user._id } }, { $group: { _id: null, total: { $sum: '$skillPoints' } } }]),
    WorkEarning.aggregate([{ $match: { userId: user._id, status: 'pending' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    WorkEarning.aggregate([{ $match: { userId: user._id } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
  ]);
  const deposited = (paidDeposits[0]?.total || 0) + (adminDeposits[0]?.total || 0), available = user.walletBalance - user.reservedBalance;
  const readyToWithdraw = Math.min(user.readyToWithdraw || 0, available);
  const progressRows=await Progress.find({userId:user._id}).select('levels').lean();
  const levelsUnlocked=progressRows.reduce((sum,row)=>sum+row.levels.filter(level=>level.unlocked||level.completed).length,0);
  return { balance: user.walletBalance, available, availableNow: user.walletBalance, readyToWithdraw, pendingWithdrawals: user.reservedBalance, totalDeposited: deposited, verifiedEarnings: (earnings[0]?.total || 0) + (verifiedWork[0]?.total || 0), pendingVerifiedEarnings: pendingEarnings[0]?.total || 0, skillPoints: user.skillPoints || 0, verifiedSkillPoints: verifiedPoints[0]?.total || 0, unlockPoints: user.unlockPoints || 0, unlockCost: LEVEL_UNLOCK_COST, levelsUnlocked, totalLevels: WORKSPACES.length*LEVELS.length, accessProgress: Math.min(100, Math.floor(levelsUnlocked / (WORKSPACES.length*LEVELS.length) * 100)), withdrawalGap: Math.max(0, 1250 - readyToWithdraw), assessmentsUnlocked: (user.unlockPoints || 0) >= LEVEL_UNLOCK_COST };
}
app.get('/api/wallet', auth, async (req, res) => res.json(await walletSummary(req.user.id)));
app.get('/api/wallet/transactions', auth, async (req,res)=>{
 const [entries,withdrawals]=await Promise.all([Entry.find({userId:req.user.id,type:'withdrawal'}).sort({createdAt:-1}).limit(50).select('amount reference transactionCode note createdAt').lean(),Withdrawal.find({userId:req.user.id,status:{$in:['pending','processing','failed']}}).sort({createdAt:-1}).limit(30).select('amount transactionCode status createdAt').lean()]);
 const completed=entries.map(e=>({...e,type:'withdrawal',direction:'debit',status:'Completed'}));
 const current=withdrawals.map(w=>({type:'withdrawal',amount:w.amount,direction:'debit',reference:'withdrawal:'+w._id,transactionCode:w.transactionCode,note:w.status==='processing'?'Withdrawal processing':w.status==='pending'?'Withdrawal pending':'Withdrawal failed · funds released',status:w.status==='processing'?'Processing':w.status==='pending'?'Pending':'Failed · funds released',createdAt:w.createdAt}));
 res.json([...completed,...current].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,50));
});
app.post('/api/admin/login', authLimit, async (req,res) => {
  const email = String(req.body?.email || '').trim().toLowerCase(), password = String(req.body?.password || '');
  if (password.length < 6 || password.length > 128) return res.status(400).json({ error: 'Administrator password must be 6–128 characters.' });
  const expected = Buffer.from(process.env.ADMIN_PASSWORD || ''), provided = Buffer.from(password);
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'Administrator password is not configured in Render.' });
  const passwordMatches = expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
  if (email !== configuredAdminEmail() || !passwordMatches) return res.status(401).json({ error: 'Administrator email or password is incorrect.' });
  const adminEmail = configuredAdminEmail();
  res.json({ token: jwt.sign({ id: 'admin', email: adminEmail, role: 'admin', portalId: PORTAL_ID }, process.env.JWT_SECRET, { expiresIn: '2h' }) });
});
app.get(adminPortalPath(), (_req,res) => { res.set('X-Robots-Tag', 'noindex, nofollow'); res.sendFile(require('path').join(__dirname, 'public', 'index.html')); });
app.post('/api/admin/earnings', async (req,res) => {
  if(!adminAuthorized(req))return res.sendStatus(401);
  const email=String(req.body?.email||'').trim().toLowerCase(),amount=Number(req.body?.amount),workReference=String(req.body?.workReference||'').trim();
  if(!emailOk(email)||!Number.isSafeInteger(amount)||amount<1||amount>100000||workReference.length<3||workReference.length>100)return res.status(400).json({error:'Provide a valid user email, amount, and unique work reference.'});
  const user=await User.findOne({portalId:PORTAL_ID,email});if(!user)return res.status(404).json({error:'No account matches that email on Kazi Kenya.'});
  const session=await mongoose.startSession();
  const transactionCode=await reserveTransactionCode();
  try{await session.withTransaction(async()=>{await Entry.create([{userId:user._id,type:'earning',amount,transactionCode,reference:`earning:${workReference}`,note:String(req.body?.note||'Verified paid work').slice(0,160)}],{session});await User.updateOne({_id:user._id,portalId:PORTAL_ID},{$inc:{walletBalance:amount}},{session})});res.status(201).json({credited:true,amount,reference:workReference,transactionCode})}
  catch(e){if(e.code===11000)return res.status(409).json({error:'That work reference has already been credited.'});throw e}
  finally{await session.endSession()}
});
app.get('/api/admin/overview', async (req,res) => {
  if (!adminAuthorized(req)) return res.sendStatus(401);
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1)), pageSize = 50;
  const portalUserIds = await User.find({ portalId: PORTAL_ID }).distinct('_id');
  const [members, memberCount, pendingDeposits, pendingWithdrawals] = await Promise.all([
    User.find({ portalId: PORTAL_ID }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).select('name username email phone walletBalance reservedBalance readyToWithdraw skillPoints unlockPoints createdAt').lean(),
    User.countDocuments({ portalId: PORTAL_ID }),
    Deposit.find({ userId: { $in: portalUserIds }, status: 'pending' }).sort({ createdAt: 1 }).limit(100).populate('userId', 'name email phone').lean(),
    Withdrawal.find({ userId: { $in: portalUserIds }, status: { $in: ['pending', 'processing'] } }).sort({ createdAt: 1 }).limit(100).populate('userId', 'name email phone').lean()
  ]);
  const [earningRows, pendingWorkEarnings] = await Promise.all([
    WorkEarning.aggregate([{ $match: { userId: { $in: members.map(m => m._id) } } }, { $group: { _id: '$userId', verifiedSkillPoints: { $sum: '$skillPoints' }, pendingAmount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } } } }]),
    WorkEarning.find({ userId: { $in: portalUserIds }, status: 'pending' }).sort({ verifiedAt: 1 }).limit(100).populate('userId', 'name email').lean()
  ]);
  const earningByUser = new Map(earningRows.map(row => [String(row._id), row]));
  res.json({ members: members.map(m => ({ ...m, availableNow: m.walletBalance || 0, withdrawalCapacity: (m.walletBalance || 0) - (m.reservedBalance || 0), readyToWithdraw: Math.min(m.readyToWithdraw || 0, (m.walletBalance || 0) - (m.reservedBalance || 0)), verifiedSkillPoints: earningByUser.get(String(m._id))?.verifiedSkillPoints || 0, pendingVerifiedEarnings: earningByUser.get(String(m._id))?.pendingAmount || 0 })), memberCount, page, pageSize, pendingDeposits, pendingWithdrawals, pendingWorkEarnings });
});
app.patch('/api/admin/members/:id/ready-to-withdraw', async (req,res) => {
  if (!adminAuthorized(req)) return res.sendStatus(401);
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Member not found.' });
  const amount = Number(req.body?.amount);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000) return res.status(400).json({ error: 'Enter a whole KES amount from 0 to 1,000,000.' });
  const user = await User.findOneAndUpdate({ _id: req.params.id, portalId: PORTAL_ID, $expr: { $gte: [{ $subtract: ['$walletBalance', '$reservedBalance'] }, amount] } }, { $set: { readyToWithdraw: amount } }, { new: true }).select('walletBalance reservedBalance readyToWithdraw');
  if (!user) return res.status(409).json({ error: 'The ready-to-withdraw amount cannot be greater than the member’s available balance.' });
  res.json({ availableNow: user.walletBalance - user.reservedBalance, readyToWithdraw: user.readyToWithdraw });
});
app.post('/api/admin/members/:id/verify-skills', async (req,res) => {
  if (!adminAuthorized(req)) return res.sendStatus(401);
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Member not found.' });
  const skillPoints = Number(req.body?.skillPoints);
  if (!Number.isSafeInteger(skillPoints) || skillPoints < 1 || skillPoints > 1000000) return res.status(400).json({ error: 'Enter a whole number of skill points to verify.' });
  const session = await mongoose.startSession(); let earning;
  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({ _id: req.params.id, portalId: PORTAL_ID }).select('skillPoints').session(session);
      if (!user) throw Object.assign(new Error('Member not found.'), { status: 404 });
      const rows = await WorkEarning.aggregate([{ $match: { userId: user._id } }, { $group: { _id: null, verified: { $sum: '$skillPoints' } } }]).session(session);
      const remaining = Math.max(0, (user.skillPoints || 0) - (rows[0]?.verified || 0));
      if (skillPoints > remaining) throw Object.assign(new Error(`Only ${remaining.toLocaleString()} unverified skill points remain.`), { status: 409 });
      [earning] = await WorkEarning.create([{ userId: user._id, skillPoints, amount: skillPoints, reference: `skill-verify:${crypto.randomUUID()}` }], { session });
    });
    res.status(201).json({ verified: true, earningId: earning.id, skillPoints: earning.skillPoints, amount: earning.amount, status: earning.status });
  } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); throw e; }
  finally { await session.endSession(); }
});
app.post('/api/admin/work-earnings/:id/confirm-available', async (req,res) => {
  if (!adminAuthorized(req)) return res.sendStatus(401);
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Verified work earning not found.' });
  const session = await mongoose.startSession(); let transactionCode, amount;
  try {
    await session.withTransaction(async () => {
      const earning = await WorkEarning.findOneAndUpdate({ _id: req.params.id, status: 'pending', userId: { $in: await User.find({ portalId: PORTAL_ID }).distinct('_id').session(session) } }, { $set: { status: 'available', availableAt: new Date() } }, { new: true, session });
      if (!earning) throw Object.assign(new Error('This verified earning is already available or no longer exists.'), { status: 409 });
      amount = earning.amount; transactionCode = await reserveTransactionCode();
      await User.updateOne({ _id: earning.userId, portalId: PORTAL_ID }, { $inc: { walletBalance: amount } }, { session });
      await Entry.create([{ userId: earning.userId, type: 'earning', amount, transactionCode, reference: `work-earning:${earning.reference}`, note: `${earning.skillPoints.toLocaleString()} skill points approved as available work earnings` }], { session });
    });
    res.json({ available: true, amount, transactionCode });
  } catch (e) { if (e.code === 11000) return res.status(409).json({ error: 'This earning was already recorded.' }); if (e.status) return res.status(e.status).json({ error: e.message }); throw e; }
  finally { await session.endSession(); }
});
app.get('/api/admin/settings', async (req,res) => {
  if (!adminAuthorized(req)) return res.sendStatus(401);
  res.json(await getQuizSettings());
});
app.patch('/api/admin/settings', async (req,res) => {
  if (!adminAuthorized(req)) return res.sendStatus(401);
  const skillPointsPerCorrect = Number(req.body?.skillPointsPerCorrect), difficultyMultipliers = req.body?.difficultyMultipliers;
  if (!Number.isInteger(skillPointsPerCorrect) || skillPointsPerCorrect < 20 || skillPointsPerCorrect > 1000 || !Array.isArray(difficultyMultipliers) || difficultyMultipliers.length !== 6 || difficultyMultipliers.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 1 || n > 10)) return res.status(400).json({ error: 'Set at least 20 skill points per correct answer and six difficulty multipliers (1–10).' });
  const settings = await QuizSettings.findOneAndUpdate({ key: `${PORTAL_ID}:main` }, { $set: { skillPointsPerCorrect, difficultyMultipliers, updatedAt: new Date() } }, { new: true, upsert: true, runValidators: true });
  res.json({ skillPointsPerCorrect: settings.skillPointsPerCorrect, difficultyMultipliers: settings.difficultyMultipliers });
});
app.post('/api/admin/members/:id/wallet-transactions',async(req,res)=>{
 if(!adminAuthorized(req))return res.sendStatus(401);if(!mongoose.isValidObjectId(req.params.id))return res.status(404).json({error:'Member not found.'});const amount=Number(req.body?.amount),action=req.body?.action,reason=String(req.body?.reason||'').trim();if(action!=='withdraw'||!Number.isSafeInteger(amount)||amount<1||amount>12000||reason.length<8||reason.length>180)return res.status(400).json({error:'Only withdrawal deductions are available. Enter a valid amount and a reason (8–180 characters).'});
 const code=await reserveTransactionCode(),user=await User.findOneAndUpdate({_id:req.params.id,portalId:PORTAL_ID,$expr:{$gte:[{$subtract:['$walletBalance','$reservedBalance']},amount]}},{$inc:{walletBalance:-amount,readyToWithdraw:-amount}},{new:true});if(!user)return res.status(409).json({error:'Member not found or withdrawal exceeds available funds.'});await Entry.create({userId:user._id,type:'withdrawal',amount,direction:'debit',transactionCode:code,reference:'admin-withdraw:'+crypto.randomUUID(),note:'Admin withdrawal · '+reason});res.json({recorded:'withdraw',transactionCode:code,balance:user.walletBalance,available:user.walletBalance-user.reservedBalance});
});
app.post('/api/admin/deposits/:id/approve',(_req,res)=>res.status(410).json({error:'Deposit approvals are disabled. Members unlock each level separately.'}));
app.post('/api/payments/deposit',auth,(_req,res)=>res.status(410).json({error:'Wallet deposits are disabled. Unlock each level separately for KES 30.'}));
app.get('/api/payments/deposits/:reference', auth, async (req,res) => {
  const deposit=await Deposit.findOne({reference:req.params.reference,userId:req.user.id}).select('reference transactionCode amount status checkoutId createdAt');
  if(!deposit)return res.status(404).json({error:'Deposit order not found.'});
  res.json(deposit);
});
// Verify signed callback bytes and the payment reference before crediting a wallet.
app.post('/api/payments/callback', express.raw({ type: 'application/json', limit: '32kb' }), async (req, res) => {
  const secret = paymentWebhookSecret();
  const signature = req.get('X-Hashpay-Signature') || req.get('X-Hash-Pay-Signature') || '';
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(req.body).digest('hex')}`;
  const a = Buffer.from(signature), b = Buffer.from(expected);
  if (!secret || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).send('Invalid signature');
  let event;
  try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).send('Invalid JSON'); }
  const reference = String(event.TransactionReference || '');
  if (!reference) return res.sendStatus(400);
  if (String(event.AccountID || '') !== String(paymentAccountId())) return res.sendStatus(200);
  const unlockPayment=await LevelUnlockPayment.findOne({reference,amount:30});
  if(unlockPayment){
    if(event.event!=='payment.success'||Number(event.ResponseCode)!==0){if(unlockPayment.status==='pending')await LevelUnlockPayment.updateOne({_id:unlockPayment._id,status:'pending'},{$set:{status:'failed'}});return res.sendStatus(200)}
    if(!Number.isSafeInteger(Number(event.TransactionAmount))||Number(event.TransactionAmount)!==30||!event.TransactionID)return res.status(400).send('Invalid payment amount or transaction ID');
    if(event.Msisdn&&normalizePhone(event.Msisdn)!==normalizePhone(unlockPayment.phone))return res.status(400).send('Phone mismatch');
    unlockPayment.checkoutId=String(event.CheckoutRequestID||unlockPayment.checkoutId||'');await markUnlockPaid(unlockPayment);return res.sendStatus(200)
  }
  if(event.event!=='payment.success'||Number(event.ResponseCode)!==0)return res.sendStatus(200);
  const amount=Number(event.TransactionAmount);if(!Number.isSafeInteger(amount)||!event.TransactionID)return res.status(400).send('Invalid payment amount or transaction ID');
  res.sendStatus(200);
});
app.post('/api/wallet/withdrawals', auth, async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isSafeInteger(amount) || amount < 1250 || amount > 12000) return res.status(400).json({ error: 'Withdrawals must be between KES 1,250 and KES 12,000.' });
  const phone = normalizePhone(req.body?.phone);
  if (!phoneOk(phone)) return res.status(400).json({ error: 'Enter a valid Kenyan mobile number.' });
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Withdrawals are temporarily unavailable. Your balance has not changed; please try again shortly.' });
  let reservedFunds = false;
  try {
    const profile = await User.findOne({ _id: req.user.id, portalId: PORTAL_ID }).select('phone walletBalance reservedBalance readyToWithdraw');
    if (!profile) return res.status(404).json({ error: 'Kazi Kenya account not found.' });
    const currentBalance = Number(profile.walletBalance || 0), reserved = Number(profile.reservedBalance || 0), ready = Number(profile.readyToWithdraw || 0);
    if (amount > ready || amount > currentBalance - reserved) return res.status(409).json({ error: 'The requested amount is above the amount currently ready to withdraw, or your wallet balance is too low.' });
    const transactionCode = await reserveTransactionCode();
    const atomicFilter = { _id: profile._id, portalId: PORTAL_ID, walletBalance: profile.walletBalance, readyToWithdraw: profile.readyToWithdraw, reservedBalance: profile.reservedBalance ?? null };
    const updated = await User.findOneAndUpdate(atomicFilter, { $inc: { reservedBalance: amount, readyToWithdraw: -amount } }, { new: true });
    if (!updated) return res.status(409).json({ error: 'Your wallet changed while submitting. Refresh the page and try again.' });
    reservedFunds = true;
    const withdrawal = await Withdrawal.create({ userId: req.user.id, amount, phone, transactionCode, status: 'processing' });
    res.status(201).json({ id: withdrawal.id, transactionCode: withdrawal.transactionCode, status: withdrawal.status, message: 'Your withdrawal is being processed and will reflect shortly.' });
  } catch (error) {
    console.error('Kazi Kenya withdrawal request failed:', error.name, error.message, 'databaseState=', mongoose.connection.readyState);
    let rollbackFailed = false;
    if (reservedFunds) try { await User.updateOne({ _id: req.user.id, portalId: PORTAL_ID }, { $inc: { reservedBalance: -amount, readyToWithdraw: amount } }); }
    catch (rollbackError) { rollbackFailed = true; console.error('Withdrawal reservation rollback failed:', rollbackError.name, rollbackError.message); }
    if (error.name?.startsWith('Mongo') || error.name?.startsWith('Mongoose') || mongoose.connection.readyState !== 1) return res.status(503).json({ error: rollbackFailed ? 'Withdrawal status needs a refresh before retrying. Check your wallet and request history.' : 'The wallet database could not save this withdrawal. Refresh and try again.' });
    throw error;
  }
});
app.get('/api/admin/withdrawals', async (req, res) => {
  if (!adminAuthorized(req)) return res.sendStatus(401);
  const status = ['pending', 'processing'].includes(req.query.status) ? req.query.status : 'pending';
  const portalUserIds = await User.find({ portalId: PORTAL_ID }).distinct('_id');
  const rows = await Withdrawal.find({ userId: { $in: portalUserIds }, status }).sort({ createdAt: 1 }).populate('userId', 'name email').limit(100);
  res.json(rows);
});
app.post('/api/admin/withdrawals/:id/start-processing', async (req,res) => {
  if (!adminAuthorized(req)) return res.sendStatus(401);
  const portalUserIds = await User.find({ portalId: PORTAL_ID }).distinct('_id');
  const item = await Withdrawal.findOneAndUpdate({ _id: req.params.id, userId: { $in: portalUserIds }, status: 'pending' }, { $set: { status: 'processing' } }, { new: true });
  if (!item) return res.status(409).json({ error: 'This withdrawal is no longer pending.' });
  res.json({ status: item.status, transactionCode: item.transactionCode });
});
app.post('/api/admin/withdrawals/:id/reconcile', async (req, res) => {
  if (!adminAuthorized(req)) return res.sendStatus(401);
  const outcome = req.body?.outcome;
  if (!['paid', 'failed'].includes(outcome)) return res.status(400).json({ error: 'Set outcome to paid or failed after checking the payment status.' });
  const portalUserIds = await User.find({ portalId: PORTAL_ID }).distinct('_id');
  const item = await Withdrawal.findOneAndUpdate({ _id: req.params.id, userId: { $in: portalUserIds }, status: 'processing' }, { $set: { status: outcome } }, { new: true });
  if (!item) return res.status(404).json({ error: 'No withdrawal awaiting reconciliation was found.' });
  if (!item.transactionCode) { item.transactionCode = await reserveTransactionCode(); await Withdrawal.updateOne({ _id: item._id }, { $set: { transactionCode: item.transactionCode } }); }
  if (outcome === 'paid') {
    await User.updateOne({ _id: item.userId, portalId: PORTAL_ID }, { $inc: { walletBalance: -item.amount, reservedBalance: -item.amount } });
    await Entry.create({ userId: item.userId, type: 'withdrawal', amount: item.amount, reference: `wd:${item.id}`, transactionCode: item.transactionCode, note: 'Kazi Yetu withdrawal sent' });
  } else {
    await User.updateOne({ _id: item.userId, portalId: PORTAL_ID }, { $inc: { reservedBalance: -item.amount, readyToWithdraw: item.amount } });
  }
  res.json({ status: outcome, transactionCode: item.transactionCode });
});
app.get('*', (_req, res) => res.sendFile(require('path').join(__dirname, 'public', 'index.html')));
app.use((err, req, res, _next) => {
  console.error(`${req.method} ${req.originalUrl} failed:`, err.name, err.message);
  const databaseUnavailable = err.name?.startsWith('Mongo') || err.name?.startsWith('Mongoose') || mongoose.connection.readyState !== 1;
  if (databaseUnavailable) return res.status(503).json({ error: 'Kazi Kenya data service is temporarily unavailable. Please retry shortly.' });
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

async function start() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) throw new Error('MONGODB_URI and JWT_SECRET are required.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await preparePortalUsers();
  await Promise.all([TransactionCode.init(), Deposit.init(), Withdrawal.init(), Entry.init()]);
  await backfillTransactionCodes();
  const port = Number(process.env.PORT || 10000);
  app.listen(port, '0.0.0.0', () => console.log(`Kazi Kenya (${PORTAL_ID}) listening on ${port}`));
}
start().catch(e => { console.error('Startup failed:', e.message); process.exit(1); });

function normalizePhone(value) { const n=String(value||'').replace(/[\s-]/g,''); return n.startsWith('+254')?n.slice(1):n.startsWith('0')?`254${n.slice(1)}`:n; }
function shuffle(items) { for(let i=items.length-1;i>0;i--){const j=crypto.randomInt(i+1);[items[i],items[j]]=[items[j],items[i]];}return items; }
