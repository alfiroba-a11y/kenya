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

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), "style-src": ["'self'", "https://fonts.googleapis.com"], "font-src": ["'self'", "https://fonts.gstatic.com", "data:"], "connect-src": ["'self'", "https://api.hashback.co.ke"] } } }));
app.use('/api/payments/hashpay/webhook', express.raw({ type: 'application/json', limit: '32kb' }));
app.use(express.json({ limit: '20kb' }));
app.use(express.static('public'));

const userSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true, maxlength: 80 }, username: { type: String, unique: true, sparse: true, lowercase: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, phone: { type: String, required: true }, password: { type: String, required: true }, walletBalance: { type: Number, default: 0 }, reservedBalance: { type: Number, default: 0 }, createdAt: { type: Date, default: Date.now } });
const User = mongoose.model('User', userSchema);
const depositSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, reference: { type: String, required: true, unique: true }, amount: { type: Number, required: true }, phone: { type: String, required: true }, status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' }, receipt: { type: String, unique: true, sparse: true }, checkoutId: String, createdAt: { type: Date, default: Date.now } });
const Deposit = mongoose.model('Deposit', depositSchema);
const withdrawalSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, amount: { type: Number, required: true }, phone: { type: String, required: true }, status: { type: String, enum: ['pending', 'processing', 'paid', 'failed'], default: 'pending' }, payoutId: String, createdAt: { type: Date, default: Date.now } });
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
const entrySchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, type: { type: String, enum: ['deposit', 'earning', 'withdrawal'], required: true }, amount: { type: Number, required: true }, reference: { type: String, required: true, unique: true }, note: String, createdAt: { type: Date, default: Date.now } });
const Entry = mongoose.model('Entry', entrySchema);
const progressSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, workspace: { type: String, required: true }, levels: { type: [{ level: Number, completed: Boolean, score: Number, completedAt: Date }], default: [] }, updatedAt: { type: Date, default: Date.now } });
progressSchema.index({ userId: 1, workspace: 1 }, { unique: true });
const Progress = mongoose.model('Progress', progressSchema);
const attemptSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, workspace: { type: String, required: true }, level: { type: Number, required: true }, answers: [{ questionId: String, correctChoice: Number }], usedAt: Date, expiresAt: { type: Date, expires: 0 } });
const QuestionAttempt = mongoose.model('QuestionAttempt', attemptSchema);

const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Please sign in to continue.' }); }
}
const emailOk = v => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 200;
const phoneOk = v => /^(?:\+?254|0)(?:7|1)\d{8}$/.test(String(v || '').replace(/[\s-]/g, ''));
const usernameOk = v => typeof v === 'string' && /^[a-zA-Z0-9_]{3,20}$/.test(v);

app.get('/api/health', (_req, res) => res.json({ ok: mongoose.connection.readyState === 1, database: 'mongodb' }));
app.post('/api/auth/register', authLimit, async (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 80 || !emailOk(email) || !phoneOk(phone) || typeof password !== 'string' || password.length < 10) return res.status(400).json({ error: 'Enter your name, a valid email, Kenyan M-Pesa number, and password of at least 10 characters.' });
  try {
    const usernameBase = name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14) || 'kaziuser';
    const user = await User.create({ name: name.trim(), username: `${usernameBase}_${crypto.randomInt(1000,9999)}`, email, phone: normalizePhone(phone), password: await bcrypt.hash(password, 12) });
    res.status(201).json(issueToken(user));
  } catch (e) { if (e.code === 11000) return res.status(409).json({ error: 'An account already uses this email.' }); throw e; }
});
app.post('/api/auth/login', authLimit, async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: String(email || '').toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(String(password || ''), user.password))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.json(issueToken(user));
});
function issueToken(user) { return { token: jwt.sign({ id: user.id, name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' }), user: { name: user.name, username: user.username, email: user.email } }; }
app.get('/api/me', auth, async (req, res) => { const user = await User.findById(req.user.id).select('name username email phone'); if (!user) return res.status(404).json({ error: 'Account not found.' }); res.json({ user }); });
app.patch('/api/profile', auth, async (req,res) => {
  const name=String(req.body?.name||'').trim(),username=String(req.body?.username||'').trim().toLowerCase();
  if(name.length<2||name.length>80||!usernameOk(username))return res.status(400).json({error:'Enter a name (2–80 characters) and username (3–20 letters, numbers, or underscores).'});
  try{const user=await User.findByIdAndUpdate(req.user.id,{$set:{name,username}},{new:true,runValidators:true}).select('name username email phone');res.json({user})}
  catch(e){if(e.code===11000)return res.status(409).json({error:'That username is already in use.'});throw e}
});
app.patch('/api/profile/password', auth, authLimit, async (req,res) => {
  const current=String(req.body?.currentPassword||''),next=String(req.body?.newPassword||'');
  if(next.length<10||next.length>128)return res.status(400).json({error:'New password must be 10–128 characters.'});
  const user=await User.findById(req.user.id);if(!user||!(await bcrypt.compare(current,user.password)))return res.status(400).json({error:'Current password is incorrect.'});
  user.password=await bcrypt.hash(next,12);await user.save();res.json({changed:true,message:'Password updated.'});
});

app.get('/api/workspaces', async (_req, res) => res.json({ workspaces: WORKSPACES, levels: LEVELS }));
app.get('/api/workspaces/progress', auth, async (req, res) => {
  const rows = await Progress.find({ userId: req.user.id }).select('workspace levels updatedAt');
  res.json({ progress: rows });
});
app.get('/api/workspaces/:slug/levels/:level/questions', auth, async (req, res) => {
  const level = Number(req.params.level), questions = getQuestions(req.params.slug, level);
  if (!questions || !Number.isInteger(level) || level < 1 || level > 6) return res.status(404).json({ error: 'Workspace or level not found.' });
  if (level > 1) {
    const progress = await Progress.findOne({ userId: req.user.id, workspace: req.params.slug });
    if (!progress?.levels.some(row => row.level === level - 1 && row.completed)) return res.status(403).json({ error: 'Complete the previous level to unlock this one.' });
  }
  const order = shuffle([...questions]);
  const randomized = order.map(q => { const choices = shuffle(q.choices.map((text,index)=>({text,index}))); return { id:q.id, prompt:q.prompt, choices:choices.map(c=>c.text), correctChoice:choices.findIndex(c=>c.index===q.correct) }; });
  const attempt = await QuestionAttempt.create({ userId:req.user.id, workspace:req.params.slug, level, answers:randomized.map(q=>({questionId:q.id,correctChoice:q.correctChoice})), expiresAt:new Date(Date.now()+60*60*1000) });
  res.json({ title: WORKSPACES.find(w=>w.slug===req.params.slug).title, level, attemptId:attempt.id, questions:randomized.map(({id,prompt,choices})=>({id,prompt,choices})) });
});
app.post('/api/workspaces/:slug/levels/:level/complete', auth, async (req, res) => {
  const level = Number(req.params.level), answers = req.body?.answers, attemptId=req.body?.attemptId;
  if (!getQuestions(req.params.slug,level) || !Number.isInteger(level) || level < 1 || level > 6) return res.status(404).json({ error: 'Workspace or level not found.' });
  if (!Array.isArray(answers) || answers.length !== 10 || answers.some(n => !Number.isInteger(n) || n < 0 || n > 3) || !mongoose.isValidObjectId(attemptId)) return res.status(400).json({ error: 'Answer all 10 questions before submitting.' });
  const session = await mongoose.startSession(); let result;
  try {
    await session.withTransaction(async () => {
      let progress = await Progress.findOne({ userId: req.user.id, workspace: req.params.slug }).session(session);
      if (level > 1 && !progress?.levels.some(row => row.level === level - 1 && row.completed)) throw Object.assign(new Error('Complete the previous level to unlock this one.'), { status: 403 });
      const attempt = await QuestionAttempt.findOneAndUpdate({ _id:attemptId,userId:req.user.id,workspace:req.params.slug,level,usedAt:null,expiresAt:{$gt:new Date()} },{ $set:{usedAt:new Date()} },{new:true,session});
      if (!attempt || attempt.answers.length !== 10) throw Object.assign(new Error('This quiz attempt expired or was already submitted. Start the level again.'), { status: 409 });
      const score = attempt.answers.reduce((total, question, i) => total + (question.correctChoice === answers[i] ? 1 : 0), 0);
      if (!progress) progress = new Progress({ userId: req.user.id, workspace: req.params.slug, levels: [] });
      const existing = progress.levels.find(row => row.level === level);
      if (score >= 7) {
        if (existing) { existing.completed = true; existing.score = Math.max(existing.score || 0, score); existing.completedAt = existing.completedAt || new Date(); }
        else progress.levels.push({ level, completed: true, score, completedAt: new Date() });
      } else if (!existing) progress.levels.push({ level, completed: false, score, completedAt: null });
      progress.updatedAt = new Date(); await progress.save({ session });
      result = { score, total: 10, passed: score >= 7, completedLevels: progress.levels.filter(row=>row.completed).length, nextLevel: score >= 7 && level < 6 ? level + 1 : null };
    });
  } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); throw e; }
  finally { await session.endSession(); }
  res.json(result);
});

async function walletSummary(userId) {
  const user = await User.findById(userId).select('walletBalance reservedBalance');
  if (!user) throw new Error('Account not found.');
  return { balance: user.walletBalance, available: user.walletBalance - user.reservedBalance, pendingWithdrawals: user.reservedBalance };
}
app.get('/api/wallet', auth, async (req, res) => res.json(await walletSummary(req.user.id)));
app.get('/api/wallet/transactions', auth, async (req, res) => res.json(await Entry.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50).select('type amount reference note createdAt')));
app.post('/api/admin/earnings', async (req,res) => {
  if(!process.env.ADMIN_TOKEN||req.get('x-admin-token')!==process.env.ADMIN_TOKEN)return res.sendStatus(401);
  const email=String(req.body?.email||'').trim().toLowerCase(),amount=Number(req.body?.amount),workReference=String(req.body?.workReference||'').trim();
  if(!emailOk(email)||!Number.isSafeInteger(amount)||amount<1||amount>100000||workReference.length<3||workReference.length>100)return res.status(400).json({error:'Provide a valid user email, amount, and unique work reference.'});
  const user=await User.findOne({email});if(!user)return res.status(404).json({error:'No account matches that email.'});
  const session=await mongoose.startSession();
  try{await session.withTransaction(async()=>{await Entry.create([{userId:user._id,type:'earning',amount,reference:`earning:${workReference}`,note:String(req.body?.note||'Verified paid work').slice(0,160)}],{session});await User.updateOne({_id:user._id},{$inc:{walletBalance:amount}},{session})});res.status(201).json({credited:true,amount,reference:workReference})}
  catch(e){if(e.code===11000)return res.status(409).json({error:'That work reference has already been credited.'});throw e}
  finally{await session.endSession()}
});
app.get('/api/public/withdrawals/recent', async (_req,res) => {
  const rows=await Withdrawal.find({status:'paid'}).sort({createdAt:-1}).limit(8).select('amount createdAt');
  res.json({ withdrawals:rows });
});
app.post('/api/payments/deposit', auth, async (req, res) => {
  const amount = Number(req.body?.amount);
  const phone = normalizePhone(req.body?.phone);
  if (!Number.isSafeInteger(amount) || amount < 650 || amount > 100000) return res.status(400).json({ error: 'Deposits must be between KES 650 and KES 100,000.' });
  if (!phoneOk(phone)) return res.status(400).json({ error: 'Enter a valid Kenyan M-Pesa number.' });
  if (!process.env.HASHPAY_ACCOUNT_ID || !process.env.HASHPAY_API_KEY || !process.env.HASHPAY_WEBHOOK_SECRET) return res.status(503).json({ error: 'HashPay STK Push is not fully configured yet.' });
  const reference = `KK-${crypto.randomUUID()}`;
  const deposit = await Deposit.create({ userId: req.user.id, amount, phone, reference });
  let response, result;
  try {
    response = await fetch('https://api.hashback.co.ke/initiatestk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: process.env.HASHPAY_API_KEY, account_id: process.env.HASHPAY_ACCOUNT_ID, amount: String(amount), msisdn: phone, reference }), signal: AbortSignal.timeout(20000) });
    result = await response.json();
  } catch (e) {
    // The request may have reached HashPay even if the response timed out; leave it pending to avoid sending a duplicate prompt.
    return res.status(202).json({ reference, status: 'pending', message: 'We could not confirm the prompt response. Check your phone and wallet before trying again.' });
  }
  if (!response.ok || result.success !== true || !result.checkout_id) {
    await Deposit.updateOne({ _id: deposit._id, status: 'pending' }, { $set: { status: 'failed' } });
    return res.status(502).json({ error: result.message || result.ResponseDescription || 'HashPay could not send the M-Pesa prompt.' });
  }
  await Deposit.updateOne({ _id: deposit._id, status: 'pending' }, { $set: { checkoutId: String(result.checkout_id) } });
  res.status(201).json({ reference, checkoutId: result.checkout_id, amount, phone, status: 'pending', message: 'M-Pesa prompt sent. Enter your PIN on your phone; your wallet updates after payment confirmation.' });
});
app.get('/api/payments/deposits/:reference', auth, async (req,res) => {
  const deposit=await Deposit.findOne({reference:req.params.reference,userId:req.user.id}).select('reference amount status receipt checkoutId createdAt');
  if(!deposit)return res.status(404).json({error:'Deposit order not found.'});
  res.json(deposit);
});
// Verify raw bytes and reference server-side. Browser-side HashPay events never credit a wallet.
app.post('/api/payments/hashpay/webhook', express.raw({ type: 'application/json', limit: '32kb' }), async (req, res) => {
  const secret = process.env.HASHPAY_WEBHOOK_SECRET || '';
  const signature = req.get('x-hashpay-signature') || '';
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(req.body).digest('hex')}`;
  const a = Buffer.from(signature), b = Buffer.from(expected);
  if (!secret || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).send('Invalid signature');
  let event;
  try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).send('Invalid JSON'); }
  if (event.event !== 'payment.success' || Number(event.ResponseCode) !== 0) return res.sendStatus(200);
  const reference = String(event.TransactionReference || '');
  const amount = Number(event.TransactionAmount);
  if (!reference || !Number.isSafeInteger(amount) || !event.TransactionID) return res.sendStatus(400);
  if (String(event.AccountID || '') !== String(process.env.HASHPAY_ACCOUNT_ID || '')) return res.sendStatus(200);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const deposit = await Deposit.findOne({ reference, status: 'pending', amount }).session(session);
      if (!deposit) return;
      if (event.Msisdn && normalizePhone(event.Msisdn) !== normalizePhone(deposit.phone)) throw Object.assign(new Error('Phone mismatch'), { status: 400 });
      const claimed = await Deposit.findOneAndUpdate({ _id: deposit._id, status: 'pending', amount }, { $set: { status: 'paid', receipt: String(event.TransactionID), checkoutId: String(event.CheckoutRequestID || deposit.checkoutId || '') } }, { new: true, session });
      if (!claimed) return;
      await User.updateOne({ _id: claimed.userId }, { $inc: { walletBalance: amount } }, { session });
      await Entry.create([{ userId: claimed.userId, type: 'deposit', amount, reference: `dep:${reference}`, note: `M-Pesa deposit · ${event.TransactionID}` }], { session });
    });
  } catch(e) { if(e.status===400)return res.status(400).send(e.message); throw e; }
  finally { await session.endSession(); }
  res.sendStatus(200);
});
app.post('/api/wallet/withdrawals', auth, async (req, res) => {
  const amount = Number(req.body?.amount), profile = await User.findById(req.user.id).select('phone');
  const phone = normalizePhone(req.body?.phone || profile?.phone);
  if (!Number.isSafeInteger(amount) || amount < 1250 || amount > 100000) return res.status(400).json({ error: 'Withdrawals must be between KES 1,250 and KES 100,000.' });
  if (!phoneOk(phone)) return res.status(400).json({ error: 'Enter a valid Kenyan mobile number.' });
  if (!profile) return res.status(404).json({ error: 'Account not found.' });
  const session = await mongoose.startSession();
  let withdrawal;
  try {
    await session.withTransaction(async () => {
      const user = await User.findOneAndUpdate({ _id: req.user.id, $expr: { $gte: [{ $subtract: ['$walletBalance', '$reservedBalance'] }, amount] } }, { $inc: { reservedBalance: amount } }, { new: true, session });
      if (!user) throw Object.assign(new Error('Your available balance is not enough for this withdrawal.'), { status: 400 });
      [withdrawal] = await Withdrawal.create([{ userId: req.user.id, amount, phone }], { session });
    });
  } catch (e) { if (e.status === 400) return res.status(400).json({ error: e.message }); throw e; }
  finally { await session.endSession(); }
  res.status(201).json({ id: withdrawal.id, status: withdrawal.status, message: 'Withdrawal request submitted. It will appear as reserved while reviewed.' });
});
app.get('/api/admin/withdrawals', async (req, res) => {
  if (!process.env.ADMIN_TOKEN || req.get('x-admin-token') !== process.env.ADMIN_TOKEN) return res.sendStatus(401);
  const status = ['pending', 'processing'].includes(req.query.status) ? req.query.status : 'pending';
  const rows = await Withdrawal.find({ status }).sort({ createdAt: 1 }).populate('userId', 'name email').limit(100);
  res.json(rows);
});
app.post('/api/admin/withdrawals/:id/reconcile', async (req, res) => {
  if (!process.env.ADMIN_TOKEN || req.get('x-admin-token') !== process.env.ADMIN_TOKEN) return res.sendStatus(401);
  const outcome = req.body?.outcome;
  if (!['paid', 'failed'].includes(outcome)) return res.status(400).json({ error: 'Set outcome to paid or failed after checking the HashPay portal.' });
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const item = await Withdrawal.findOne({ _id: req.params.id, status: 'processing' }).session(session);
      if (!item) throw Object.assign(new Error('No ambiguous payout was found for this request.'), { status: 404 });
      item.status = outcome;
      if (outcome === 'paid') item.payoutId = String(req.body.payoutId || 'manually-confirmed');
      await item.save({ session });
      if (outcome === 'paid') {
        await User.updateOne({ _id: item.userId }, { $inc: { walletBalance: -item.amount, reservedBalance: -item.amount } }, { session });
        await Entry.create([{ userId: item.userId, type: 'withdrawal', amount: item.amount, reference: `wd:${item.id}`, note: `M-Pesa payout · ${item.payoutId}` }], { session });
      } else {
        await User.updateOne({ _id: item.userId }, { $inc: { reservedBalance: -item.amount } }, { session });
      }
    });
    res.json({ status: outcome });
  } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); throw e; }
  finally { await session.endSession(); }
});
app.post('/api/admin/withdrawals/:id/pay', async (req, res) => {
  if (!process.env.ADMIN_TOKEN || req.get('x-admin-token') !== process.env.ADMIN_TOKEN) return res.sendStatus(401);
  if (!process.env.HASHPAY_API_KEY || !process.env.HASHPAY_SECURITY_CREDENTIAL) return res.status(503).json({ error: 'HashPay B2C credentials are not configured.' });
  const item = await Withdrawal.findOneAndUpdate({ _id: req.params.id, status: 'pending' }, { $set: { status: 'processing' } }, { new: true });
  if (!item) return res.status(409).json({ error: 'Request is unavailable or already being processed.' });
  try {
    const response = await fetch('https://api.hashback.co.ke/V2/processwithdrawal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: process.env.HASHPAY_API_KEY, msisdn: item.phone, amount: item.amount, SecurityCredential: process.env.HASHPAY_SECURITY_CREDENTIAL }) });
    const result = await response.json();
    if (!response.ok || result.success !== true) {
      const session = await mongoose.startSession();
      try { await session.withTransaction(async () => { await Withdrawal.updateOne({ _id: item._id, status: 'processing' }, { $set: { status: 'failed' } }, { session }); await User.updateOne({ _id: item.userId }, { $inc: { reservedBalance: -item.amount } }, { session }); }); } finally { await session.endSession(); }
      return res.status(502).json({ error: result.message || 'HashPay could not process the payout.' });
    }
    const payoutId = String(result.details?.transactionId || result.details?.TransactionID || result.details?.TransactionID || 'accepted');
    const session = await mongoose.startSession();
    try { await session.withTransaction(async () => {
      await Withdrawal.updateOne({ _id: item._id, status: 'processing' }, { $set: { status: 'paid', payoutId } }, { session });
      await User.updateOne({ _id: item.userId }, { $inc: { walletBalance: -item.amount, reservedBalance: -item.amount } }, { session });
      await Entry.create([{ userId: item.userId, type: 'withdrawal', amount: item.amount, reference: `wd:${item.id}`, note: `M-Pesa payout · ${payoutId}` }], { session });
    }); } finally { await session.endSession(); }
    res.json({ status: 'paid', payoutId });
  } catch (e) {
    // A timeout may happen after HashPay sent the money. Keep the request reserved and in processing for reconciliation; never auto-retry an ambiguous payout.
    res.status(502).json({ error: 'Payout status is uncertain. The request remains reserved for manual reconciliation; do not retry until checked in HashPay.' });
  }
});

app.get('*', (_req, res) => res.sendFile(require('path').join(__dirname, 'public', 'index.html')));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Something went wrong. Please try again.' }); });

async function start() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) throw new Error('MONGODB_URI and JWT_SECRET are required.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const port = Number(process.env.PORT || 10000);
  app.listen(port, '0.0.0.0', () => console.log(`Kazi Kenya listening on ${port}`));
}
start().catch(e => { console.error('Startup failed:', e.message); process.exit(1); });

function normalizePhone(value) { const n=String(value||'').replace(/[\s-]/g,''); return n.startsWith('+254')?n.slice(1):n.startsWith('0')?`254${n.slice(1)}`:n; }
function shuffle(items) { for(let i=items.length-1;i>0;i--){const j=crypto.randomInt(i+1);[items[i],items[j]]=[items[j],items[i]];}return items; }
