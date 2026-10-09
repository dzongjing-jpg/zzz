#!/usr/bin/env python3
"""Fangcun contribution exchange. Zero third-party dependencies, Python 3.10+."""
import os, re, json, hmac, html, time, base64, sqlite3, hashlib, secrets, threading
from datetime import datetime
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit, quote

ROOT=os.path.dirname(__file__)
DB=os.environ.get('DB_PATH', os.path.join(ROOT,'fangcun.db'))
HOST=os.environ.get('HOST','127.0.0.1')
PORT=int(os.environ.get('PORT','8080'))
SECURE=os.environ.get('COOKIE_SECURE','0')=='1'
LOCK=threading.Lock()

def conn():
 c=sqlite3.connect(DB,timeout=15,isolation_level=None);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON');c.execute('PRAGMA busy_timeout=15000');return c

def init():
 with conn() as c:
  c.executescript('''PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, qq TEXT UNIQUE, character_name TEXT, role TEXT NOT NULL DEFAULT 'player', verified INTEGER NOT NULL DEFAULT 0, balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS bind_codes (id INTEGER PRIMARY KEY, qq TEXT NOT NULL, character_name TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER, created_by INTEGER REFERENCES users(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', cost INTEGER NOT NULL CHECK(cost>0), stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0), active INTEGER NOT NULL DEFAULT 1, emoji TEXT NOT NULL DEFAULT '🎁', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),product_id INTEGER REFERENCES products(id),product_title TEXT NOT NULL,cost INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',note TEXT NOT NULL DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),delta INTEGER NOT NULL,balance_after INTEGER NOT NULL,reason TEXT NOT NULL,actor_id INTEGER REFERENCES users(id),order_id INTEGER REFERENCES orders(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY, ip TEXT NOT NULL,created_at INTEGER NOT NULL);
''')
  if not c.execute('SELECT COUNT(*) FROM products').fetchone()[0]:
   c.executemany('INSERT INTO products(title,description,cost,stock,emoji) VALUES(?,?,?,?,?)', [('一等上古碎片','游戏内人工发放',500,10,'💎'),('随机变身卡','游戏内人工发放',300,20,'🎴'),('游戏银两','数量由管理员确认',1000,5,'🪙'),('神兽抽奖资格','按帮会规则参与抽奖',2000,3,'🐉')])

def hashpw(p):
 salt=secrets.token_bytes(16);dig=hashlib.scrypt(p.encode(),salt=salt,n=2**14,r=8,p=1);return base64.b64encode(salt+dig).decode()
def checkpw(p,stored):
 try:
  b=base64.b64decode(stored);d=hashlib.scrypt(p.encode(),salt=b[:16],n=2**14,r=8,p=1);return hmac.compare_digest(d,b[16:])
 except Exception:return False

def esc(s):return html.escape(str(s or ''),quote=True)
def ndate(ts):return datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M')
def token_hash(t):return hashlib.sha256(t.encode()).hexdigest()

def layout(title,body,user=None,csrf='',msg=''):
 menu=''
 if user:
  admin='<a href="/admin">管理后台</a>' if user['role']=='admin' else ''
  menu=f'<a href="/">商城</a><a href="/records">我的记录</a>{admin}<form method="post" action="/logout" class="inline"><input type="hidden" name="csrf" value="{esc(csrf)}"><button class="navlink">退出登录</button></form>'
 else:menu='<a href="/login">登录</a><a href="/register">注册</a>'
 alert=f'<div class="alert">{esc(msg)}</div>' if msg else ''
 return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)} · 方寸山帮贡兑换阁</title><style>
:root{{--bg:#101f1d;--panel:#203a35;--panel2:#2b4740;--gold:#f1cc86;--text:#f8f0df;--muted:#c0cbc1;--line:#3e5b51}}*{{box-sizing:border-box}}body{{margin:0;background:radial-gradient(ellipse at top,#2a4740,#101f1d 75%);color:var(--text);font:15px/1.65 system-ui,-apple-system,'Microsoft YaHei',sans-serif;min-height:100vh}}a{{color:var(--gold);text-decoration:none}}.wrap{{max-width:1030px;margin:auto;padding:20px}}header{{border-bottom:1px solid var(--line);background:#132721b8}}header .wrap{{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}}.brand{{font-size:21px;font-weight:800;color:var(--gold);letter-spacing:2px}}nav{{display:flex;gap:18px;align-items:center;flex-wrap:wrap}}nav a,.navlink{{font-size:13px}}.navlink{{background:none;border:0;cursor:pointer;padding:0;color:var(--gold)}}h1,h2,h3{{color:var(--gold);line-height:1.3}}h1{{font-size:27px}}h2{{font-size:20px}}.muted{{color:var(--muted)}}.panel{{background:var(--panel);border:1px solid var(--line);padding:22px;border-radius:14px;margin:16px 0}}.hero{{text-align:center;padding:34px 8px}}.hero h1{{font-size:32px;margin:4px}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:15px}}.product{{background:var(--panel);border:1px solid var(--line);padding:18px;border-radius:13px}}.pic{{background:var(--panel2);text-align:center;border-radius:12px;font-size:54px;padding:20px;margin-bottom:12px}}.gold{{color:var(--gold)}}.big{{font-size:36px;font-weight:800}}.btn{{border:none;border-radius:8px;background:var(--gold);color:#203129;padding:10px 18px;font-weight:750;cursor:pointer}}.btn:disabled{{opacity:.5;cursor:not-allowed}}.btn.secondary{{background:var(--panel2);color:var(--text);border:1px solid var(--line)}}input,select,textarea{{background:#132c26;border:1px solid #5b756a;border-radius:8px;padding:10px;color:white;width:100%;font:inherit}}label{{display:block;margin:14px 0 5px}}.form{{max-width:460px;margin:25px auto}}.inline{{display:inline}}.row{{display:flex;gap:12px;align-items:center;flex-wrap:wrap}}.row>*{{min-width:0}}.alert{{padding:12px 15px;border:1px solid #c4a35b;background:#584a26;border-radius:8px;margin:16px 0}}table{{width:100%;border-collapse:collapse;min-width:550px}}td,th{{padding:12px 10px;border-bottom:1px solid var(--line);text-align:left}}.scroll{{overflow:auto}}small{{color:var(--muted)}}.tag{{padding:2px 8px;background:var(--panel2);border-radius:6px}}footer{{text-align:center;color:var(--muted);padding:42px 12px;font-size:12px}}@media(max-width:600px){{.wrap{{padding:14px}}.panel{{padding:16px}}}}
</style></head><body><header><div class="wrap"><div class="brand">◈ 灵台方寸山 · 帮贡兑换阁</div><nav>{menu}</nav></div></header><main class="wrap">{alert}{body}</main><footer>帮会专用积分兑换系统 · 奖励以管理员最终发放为准</footer></body></html>'''

class App(BaseHTTPRequestHandler):
 def log_message(self,fmt,*args): pass
 def cookie(self,name):
  try:c=SimpleCookie(self.headers.get('Cookie',''));return c[name].value if name in c else ''
  except Exception:return ''
 def auth(self):
  t=self.cookie('sid')
  if not t:return None,None
  with conn() as c:
   s=c.execute('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?',(token_hash(t),int(time.time()))).fetchone()
   if not s:return None,None
   u=c.execute('SELECT * FROM users WHERE id=?',(s['user_id'],)).fetchone()
   return u,s
 def query(self):return {k:v[0] for k,v in parse_qs(urlsplit(self.path).query).items()}
 def form(self):
  length=int(self.headers.get('Content-Length','0'))
  if length>20000:raise ValueError('提交内容过大')
  return {k:v[0] for k,v in parse_qs(self.rfile.read(length).decode('utf-8')).items()}
 def respond(self,body,status=200,headers=None):
  d=body.encode();self.send_response(status);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(d)));self.send_header('X-Content-Type-Options','nosniff');self.send_header('X-Frame-Options','DENY');self.send_header('Referrer-Policy','same-origin');self.send_header('Content-Security-Policy',"default-src 'none';style-src 'unsafe-inline';form-action 'self';base-uri 'none'")
  for k,v in headers or []:self.send_header(k,v)
  self.end_headers();self.wfile.write(d)
 def redirect(self,url,cookie=None):self.send_response(303);self.send_header('Location',url);self.send_header('Cache-Control','no-store');self.send_header('Content-Length','0');self.send_header('Referrer-Policy','same-origin');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Set-Cookie',cookie) if cookie else None;self.end_headers()
 def flash(self,text):self.redirect('/?msg='+quote(text))
 def need(self,u,s,admin=False):
  if not u:self.redirect('/login');return False
  if admin and u['role']!='admin':self.respond(layout('无权限','<div class="panel">无管理员权限</div>',u,s['csrf']),403);return False
  return True
 def postguard(self,f,s):return s is not None and hmac.compare_digest(f.get('csrf',''),s['csrf'])
 def do_GET(self):
  path=urlsplit(self.path).path;u,s=self.auth();csrf=s['csrf'] if s else '';q=self.query();msg=q.get('msg','')
  if path=='/health':return self.respond('OK')
  if path=='/':
   with conn() as c:products=c.execute('SELECT * FROM products WHERE active=1 ORDER BY id DESC').fetchall()
   account=f'<div class="panel"><div class="muted">当前可用帮贡</div><div class="big gold">{u["balance"]:,}</div><div>角色：{esc(u["character_name"] or "未绑定")} · QQ：{esc(u["qq"] or "未绑定")}</div></div>' if u else '<div class="panel">登录并验证QQ绑定后，即可查看帮贡和兑换奖励。 <a href="/register">立即注册</a></div>'
   items=''.join(f'<article class="product"><div class="pic">{esc(p["emoji"])}</div><h3>{esc(p["title"])}</h3><div class="muted">{esc(p["description"])}</div><p class="gold"><b>{p["cost"]} 帮贡</b> · 库存 {p["stock"]}</p><form method="post" action="/redeem"><input type="hidden" name="csrf" value="{esc(csrf)}"><input type="hidden" name="id" value="{p["id"]}"><button class="btn" {"disabled" if not u or not u["verified"] or p["stock"]==0 or u["balance"]<p["cost"] else ""}>兑换</button></form></article>' for p in products)
   body=f'<section class="hero"><div class="gold">天书奇谈 · 灵台方寸山</div><h1>帮贡兑换阁</h1><div class="muted">积善成贡 · 以贡易宝</div></section>{account}<h2>兑换宝物</h2><div class="grid">{items}</div>'
   if u and not u['verified']:body+='<div class="panel">尚未绑定验证QQ，<a href="/bind">前往绑定</a>。请向管理员领取验证码。</div>'
   return self.respond(layout('商城',body,u,csrf,msg))
  if path in ('/login','/register'):
   kind='登录' if path=='/login' else '注册'
   x=f'<label>用户名</label><input name="username" required minlength="3" maxlength="40" autocomplete="username"><label>密码</label><input type="password" name="password" required minlength="10" autocomplete="{ "current-password" if path=="/login" else "new-password" }">'
   return self.respond(layout(kind,f'<div class="panel form"><h1>{kind}</h1><form method="post" action="{path}">{x}<p><button class="btn">{kind}</button></p></form><small>密码至少10位。本站账号与QQ密码无关，请勿填写QQ密码。</small></div>',u,csrf,msg))
  if path=='/bind':
   if not self.need(u,s):return
   body=f'<div class="panel form"><h1>绑定QQ与游戏角色</h1><p class="muted">联系帮会管理员，提供QQ号和游戏角色名，领取一次性验证码。验证码有效期30分钟。</p><form method="post" action="/bind"><input type="hidden" name="csrf" value="{esc(csrf)}"><label>QQ号码</label><input name="qq" inputmode="numeric" pattern="[1-9][0-9]{{4,11}}" required><label>绑定验证码</label><input name="code" required maxlength="24"><button class="btn" style="margin-top:18px">完成绑定</button></form></div>'
   return self.respond(layout('绑定QQ',body,u,csrf,msg))
  if path=='/records':
   if not self.need(u,s):return
   with conn() as c:
    orders=c.execute('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 100',(u['id'],)).fetchall();led=c.execute('SELECT * FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 100',(u['id'],)).fetchall()
   labels={'pending':'待发放','fulfilled':'已发放','refunded':'已拒绝退款'}
   t1=''.join(f'<tr><td>#{o["id"]}</td><td>{esc(o["product_title"])}</td><td>{o["cost"]}</td><td>{labels.get(o["status"],o["status"])}</td><td>{esc(o["created_at"])}</td></tr>' for o in orders)
   t2=''.join(f'<tr><td>{esc(l["created_at"])}</td><td>{l["delta"]:+}</td><td>{l["balance_after"]}</td><td>{esc(l["reason"])}</td></tr>' for l in led)
   return self.respond(layout('我的记录',f'<h1>我的记录</h1><div class="panel"><h2>兑换订单</h2><div class="scroll"><table><tr><th>订单</th><th>奖励</th><th>花费</th><th>状态</th><th>时间</th></tr>{t1}</table></div></div><div class="panel"><h2>帮贡流水</h2><div class="scroll"><table><tr><th>时间</th><th>变动</th><th>余额</th><th>原因</th></tr>{t2}</table></div></div>',u,csrf,msg))
  if path=='/admin':
   if not self.need(u,s,True):return
   with conn() as c:
    users=c.execute('SELECT * FROM users ORDER BY id DESC LIMIT 200').fetchall();orders=c.execute('SELECT orders.*,users.username,users.qq FROM orders JOIN users ON users.id=orders.user_id ORDER BY orders.id DESC LIMIT 100').fetchall();products=c.execute('SELECT * FROM products ORDER BY id DESC').fetchall();codes=c.execute('SELECT qq,character_name,expires_at,used_at FROM bind_codes ORDER BY id DESC LIMIT 20').fetchall()
   uc=''.join(f'<option value="{p["id"]}">{esc(p["username"])} ({esc(p["qq"] or "未绑定")}) · {p["balance"]} 帮贡</option>' for p in users)
   us=''.join(f'<tr><td>{esc(p["username"])}</td><td>{esc(p["qq"])}</td><td>{esc(p["character_name"])}</td><td>{p["balance"]}</td><td>{"已验证" if p["verified"] else "未验证"}</td></tr>' for p in users)
   oo=''.join(f'<tr><td>#{o["id"]}</td><td>{esc(o["username"])}<br><small>{esc(o["qq"])}</small></td><td>{esc(o["product_title"])} · {o["cost"]}</td><td>{esc(o["status"])}</td><td>{self.action("/admin/order",csrf,{"id":o["id"],"status":"fulfilled"},"确认发放")+self.action("/admin/order",csrf,{"id":o["id"],"status":"refunded"},"拒绝并退款") if o["status"]=="pending" else "—"}</td></tr>' for o in orders)
   pp=''.join(f'<tr><td>{p["id"]}</td><td>{esc(p["title"])}</td><td>{p["cost"]}</td><td>{p["stock"]}</td><td>{"上架" if p["active"] else "下架"}</td><td>{self.action("/admin/toggle",csrf,{"id":p["id"]},"下架" if p["active"] else "上架")}</td></tr>' for p in products)
   cc=''.join(f'<tr><td>{esc(a["qq"])}</td><td>{esc(a["character_name"])}</td><td>{ndate(a["expires_at"])}</td><td>{"已使用" if a["used_at"] else "未使用"}</td></tr>' for a in codes)
   hid=f'<input type="hidden" name="csrf" value="{esc(csrf)}">'
   body=f'''<h1>帮会管理后台</h1><div class="grid"><div class="panel"><h2>生成绑定验证码</h2><form method="post" action="/admin/code">{hid}<label>玩家QQ号</label><input name="qq" required pattern="[1-9][0-9]{{4,11}}"><label>游戏角色名</label><input name="character" required maxlength="60"><p><button class="btn">生成一次性验证码</button></p></form></div><div class="panel"><h2>手动增加 / 扣除帮贡</h2><form method="post" action="/admin/points">{hid}<label>玩家</label><select name="user_id">{uc}</select><label>变动数值（扣除填写负数）</label><input type="number" name="delta" required min="-10000000" max="10000000"><label>原因</label><input name="reason" required maxlength="120"><p><button class="btn">确认调整</button></p></form></div><div class="panel"><h2>添加奖励</h2><form method="post" action="/admin/product">{hid}<label>名称</label><input name="title" required maxlength="80"><label>说明</label><input name="description" maxlength="300"><label>图标（emoji）</label><input name="emoji" value="🎁" maxlength="8"><label>帮贡价格</label><input type="number" name="cost" required min="1"><label>库存</label><input type="number" name="stock" required min="0"><p><button class="btn">添加奖励</button></p></form></div></div><div class="panel"><h2>兑换订单</h2><div class="scroll"><table><tr><th>订单</th><th>玩家</th><th>商品</th><th>状态</th><th>操作</th></tr>{oo}</table></div></div><div class="panel"><h2>奖励管理</h2><div class="scroll"><table><tr><th>ID</th><th>奖励</th><th>帮贡</th><th>库存</th><th>状态</th><th>操作</th></tr>{pp}</table></div><p class="muted">修改奖励价格或库存可通过数据库管理，正式使用建议扩展编辑表单。</p></div><div class="panel"><h2>成员列表</h2><div class="scroll"><table><tr><th>用户名</th><th>QQ</th><th>角色</th><th>余额</th><th>绑定状态</th></tr>{us}</table></div></div><div class="panel"><h2>最近绑定验证码记录（不显示明文）</h2><div class="scroll"><table><tr><th>QQ</th><th>角色</th><th>过期时间</th><th>状态</th></tr>{cc}</table></div></div>'''
   return self.respond(layout('管理后台',body,u,csrf,msg))
  self.respond(layout('404','<h1>页面不存在</h1>',u,csrf),404)
 def action(self,path,csrf,fields,label):
  fs=''.join(f'<input type="hidden" name="{esc(k)}" value="{esc(v)}">' for k,v in fields.items())
  return f'<form method="post" action="{path}" class="inline"><input type="hidden" name="csrf" value="{esc(csrf)}">{fs}<button class="btn secondary" style="margin:2px">{esc(label)}</button></form>'
 def do_POST(self):
  path=urlsplit(self.path).path
  try:f=self.form()
  except Exception:return self.flash('请求格式错误')
  u,s=self.auth()
  if path=='/register':
   name=f.get('username','').strip();pw=f.get('password','')
   if not re.fullmatch(r'[a-zA-Z0-9_]{3,40}',name) or len(pw)<10 or len(pw)>128:return self.redirect('/register?msg='+quote('用户名仅限英数字下划线，密码至少10位'))
   try:
    with conn() as c:c.execute('INSERT INTO users(username,password_hash) VALUES(?,?)',(name,hashpw(pw)))
   except sqlite3.IntegrityError:return self.redirect('/register?msg='+quote('用户名已被占用'))
   return self.redirect('/login?msg='+quote('注册成功，请登录'))
  if path=='/login':
   ip=self.client_address[0];now=int(time.time())
   with conn() as c:
    c.execute('DELETE FROM login_attempts WHERE created_at<?',(now-900,))
    if c.execute('SELECT COUNT(*) FROM login_attempts WHERE ip=?',(ip,)).fetchone()[0]>=12:return self.redirect('/login?msg='+quote('登录尝试过多，15分钟后重试'))
    c.execute('INSERT INTO login_attempts(ip,created_at) VALUES(?,?)',(ip,now))
    person=c.execute('SELECT * FROM users WHERE username=?',(f.get('username',''),)).fetchone()
    if not person or not checkpw(f.get('password',''),person['password_hash']):return self.redirect('/login?msg='+quote('用户名或密码错误'))
    c.execute('DELETE FROM login_attempts WHERE ip=?',(ip,))
    t=secrets.token_urlsafe(32);csrf=secrets.token_urlsafe(24)
    c.execute('INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)',(token_hash(t),person['id'],csrf,now+7*86400))
   return self.redirect('/bind' if not person['verified'] and person['role']!='admin' else '/',f'sid={t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800'+('; Secure' if SECURE else ''))
  if not self.need(u,s):return
  if not self.postguard(f,s):return self.respond(layout('安全校验失败','<h1>表单已过期，请刷新后再试</h1>',u,s['csrf']),403)
  if path=='/logout':
   with conn() as c:c.execute('DELETE FROM sessions WHERE token_hash=?',(token_hash(self.cookie('sid')),))
   return self.redirect('/login','sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'+('; Secure' if SECURE else ''))
  if path=='/bind':
   qq=f.get('qq','').strip();code=f.get('code','').strip()
   if not re.fullmatch(r'[1-9][0-9]{4,11}',qq):return self.redirect('/bind?msg='+quote('QQ号码格式不正确'))
   with LOCK,conn() as c:
    c.execute('BEGIN IMMEDIATE')
    record=c.execute('SELECT * FROM bind_codes WHERE qq=? AND used_at IS NULL AND expires_at>? ORDER BY id DESC LIMIT 1',(qq,int(time.time()))).fetchone()
    if not record or not hmac.compare_digest(record['code_hash'],token_hash(code)):
     c.execute('ROLLBACK');return self.redirect('/bind?msg='+quote('绑定码无效或已过期'))
    try:
     c.execute('UPDATE users SET qq=?,character_name=?,verified=1 WHERE id=? AND verified=0',(qq,record['character_name'],u['id']))
     if c.execute('SELECT changes()').fetchone()[0]!=1:raise ValueError('当前账号已绑定')
     c.execute('UPDATE bind_codes SET used_at=? WHERE id=?',(int(time.time()),record['id']))
     c.execute('COMMIT')
    except (sqlite3.IntegrityError,ValueError):c.execute('ROLLBACK');return self.redirect('/bind?msg='+quote('QQ已被其他账号使用，或当前账号已绑定'))
   return self.flash('绑定成功')
  if path=='/redeem':
   if not u['verified']:return self.flash('请先验证QQ绑定')
   try:pid=int(f.get('id','0'))
   except ValueError:return self.flash('奖励无效')
   with LOCK,conn() as c:
    c.execute('BEGIN IMMEDIATE');p=c.execute('SELECT * FROM products WHERE id=? AND active=1',(pid,)).fetchone();bal=c.execute('SELECT balance FROM users WHERE id=?',(u['id'],)).fetchone()['balance']
    if not p or p['stock']<=0 or bal<p['cost']:c.execute('ROLLBACK');return self.flash('帮贡不足、库存不足或奖励已下架')
    c.execute('UPDATE users SET balance=balance-? WHERE id=?',(p['cost'],u['id']));c.execute('UPDATE products SET stock=stock-1 WHERE id=?',(pid,));o=c.execute('INSERT INTO orders(user_id,product_id,product_title,cost) VALUES(?,?,?,?)',(u['id'],pid,p['title'],p['cost'])).lastrowid
    c.execute('INSERT INTO ledger(user_id,delta,balance_after,reason,actor_id,order_id) VALUES(?,?,?,?,?,?)',(u['id'],-p['cost'],bal-p['cost'],'兑换 '+p['title'],u['id'],o));c.execute('COMMIT')
   return self.redirect('/records?msg='+quote('兑换提交成功，等待管理员发放'))
  if u['role']!='admin':return self.flash('无管理员权限')
  if path=='/admin/code':
   qq=f.get('qq','').strip();character=f.get('character','').strip()
   if not re.fullmatch(r'[1-9][0-9]{4,11}',qq) or not 1<=len(character)<=60:return self.flash('QQ或角色名格式不正确')
   code=secrets.token_hex(5).upper()
   with conn() as c:
    if c.execute('SELECT 1 FROM users WHERE qq=?',(qq,)).fetchone():return self.flash('该QQ已被绑定')
    c.execute('UPDATE bind_codes SET used_at=? WHERE qq=? AND used_at IS NULL',(int(time.time()),qq))
    c.execute('INSERT INTO bind_codes(qq,character_name,code_hash,expires_at,created_by) VALUES(?,?,?,?,?)',(qq,character,token_hash(code),int(time.time())+1800,u['id']))
   return self.respond(layout('绑定验证码',f'<div class="panel form"><h1>一次性绑定码</h1><p>QQ：{esc(qq)} / 角色：{esc(character)}</p><div class="big gold">{code}</div><p>有效期30分钟，仅展示一次。请管理员通过可信渠道私下发给对应玩家。</p><a class="btn secondary" href="/admin">返回后台</a></div>',u,s['csrf']))
  if path=='/admin/points':
   try:uid=int(f.get('user_id',''));delta=int(f.get('delta',''))
   except ValueError:return self.flash('数字无效')
   reason=f.get('reason','').strip()
   if not delta or abs(delta)>10000000 or not 1<=len(reason)<=120:return self.flash('请填写正确的帮贡变动值和原因')
   with LOCK,conn() as c:
    c.execute('BEGIN IMMEDIATE');p=c.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone()
    if not p or p['balance']+delta<0:c.execute('ROLLBACK');return self.flash('目标玩家不存在或扣减超过余额')
    c.execute('UPDATE users SET balance=balance+? WHERE id=?',(delta,uid));c.execute('INSERT INTO ledger(user_id,delta,balance_after,reason,actor_id) VALUES(?,?,?,?,?)',(uid,delta,p['balance']+delta,reason,u['id']));c.execute('COMMIT')
   return self.redirect('/admin?msg='+quote('帮贡调整成功'))
  if path=='/admin/product':
   title=f.get('title','').strip();desc=f.get('description','').strip();emoji=f.get('emoji','🎁').strip()
   try:cost=int(f.get('cost',''));stock=int(f.get('stock',''))
   except ValueError:return self.flash('价格或库存无效')
   if not 1<=len(title)<=80 or len(desc)>300 or not 1<=cost<=10000000 or not 0<=stock<=10000000 or len(emoji)>8:return self.flash('商品字段无效')
   with conn() as c:c.execute('INSERT INTO products(title,description,cost,stock,emoji) VALUES(?,?,?,?,?)',(title,desc,cost,stock,emoji))
   return self.redirect('/admin?msg='+quote('奖励已添加'))
  if path=='/admin/toggle':
   try:pid=int(f.get('id',''))
   except ValueError:return self.flash('奖励无效')
   with conn() as c:c.execute('UPDATE products SET active=1-active WHERE id=?',(pid,))
   return self.redirect('/admin?msg='+quote('商品状态已切换'))
  if path=='/admin/order':
   try:oid=int(f.get('id',''))
   except ValueError:return self.flash('订单无效')
   status=f.get('status','')
   if status not in ('fulfilled','refunded'):return self.flash('订单状态无效')
   with LOCK,conn() as c:
    c.execute('BEGIN IMMEDIATE');o=c.execute('SELECT * FROM orders WHERE id=? AND status="pending"',(oid,)).fetchone()
    if not o:c.execute('ROLLBACK');return self.flash('订单已处理或不存在')
    c.execute('UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',(status,oid))
    if status=='refunded':
     c.execute('UPDATE users SET balance=balance+? WHERE id=?',(o['cost'],o['user_id']));bal=c.execute('SELECT balance FROM users WHERE id=?',(o['user_id'],)).fetchone()['balance']
     c.execute('INSERT INTO ledger(user_id,delta,balance_after,reason,actor_id,order_id) VALUES(?,?,?,?,?,?)',(o['user_id'],o['cost'],bal,'订单拒绝退款 #'+str(oid),u['id'],oid))
     if o['product_id']:c.execute('UPDATE products SET stock=stock+1 WHERE id=?',(o['product_id'],))
    c.execute('COMMIT')
   return self.redirect('/admin?msg='+quote('订单处理成功'))
  return self.flash('操作无效')

if __name__=='__main__':
 init();print(f'Starting Fangcun at http://{HOST}:{PORT}',flush=True);ThreadingHTTPServer((HOST,PORT),App).serve_forever()