import os,sys,tempfile,threading,urllib.request,urllib.parse,http.cookiejar
D=tempfile.TemporaryDirectory();os.environ['DB_PATH']=os.path.join(D.name,'test.db')
from app import init,conn,hashpw,App,ThreadingHTTPServer
init()
with conn() as c:
 c.execute('INSERT INTO users(username,password_hash,role,verified) VALUES(?,?,?,1)',('admin',hashpw('secret_password'),'admin'))
server=ThreadingHTTPServer(('127.0.0.1',0),App);threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_port)

def client():
 jar=http.cookiejar.CookieJar();op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar));return op

def request(op,path,data=None):
 raw=urllib.parse.urlencode(data).encode() if data is not None else None
 return op.open(base+path,data=raw).read().decode()

def csrf(op):
 import re
 data=request(op,'/')
 return re.search(r'name="csrf" value="([^"]+)"',data).group(1)
admin=client();request(admin,'/login',{'username':'admin','password':'secret_password'})
ac=csrf(admin)
assert '帮会管理后台' in request(admin,'/admin')
result=request(admin,'/admin/code',{'csrf':ac,'qq':'12345678','character':'小剑客'})
import re
code=re.search(r'class="big gold">([A-F0-9]+)</div>',result).group(1)
player=client();request(player,'/register',{'username':'player01','password':'mysecurepass123'})
request(player,'/login',{'username':'player01','password':'mysecurepass123'})
pc=csrf(player)
request(player,'/bind',{'csrf':pc,'qq':'12345678','code':code})
with conn() as c:
 uid=c.execute('SELECT id FROM users WHERE username="player01"').fetchone()['id']; assert c.execute('SELECT verified FROM users WHERE id=?',(uid,)).fetchone()['verified']==1
request(admin,'/admin/points',{'csrf':ac,'user_id':uid,'delta':1000,'reason':'帮会贡献'})
with conn() as c: assert c.execute('SELECT balance FROM users WHERE id=?',(uid,)).fetchone()['balance']==1000
request(player,'/redeem',{'csrf':pc,'id':1})
with conn() as c:
 assert c.execute('SELECT balance FROM users WHERE id=?',(uid,)).fetchone()['balance']==500
 assert c.execute('SELECT stock FROM products WHERE id=1').fetchone()['stock']==9
 oid=c.execute('SELECT id FROM orders WHERE user_id=?',(uid,)).fetchone()['id']
request(admin,'/admin/order',{'csrf':ac,'id':oid,'status':'refunded'})
with conn() as c:
 assert c.execute('SELECT balance FROM users WHERE id=?',(uid,)).fetchone()['balance']==1000
 assert c.execute('SELECT stock FROM products WHERE id=1').fetchone()['stock']==10
 assert c.execute('SELECT COUNT(*) FROM ledger WHERE user_id=?',(uid,)).fetchone()[0]==3
request(admin,'/admin/order',{'csrf':ac,'id':oid,'status':'refunded'})
with conn() as c:assert c.execute('SELECT balance FROM users WHERE id=?',(uid,)).fetchone()['balance']==1000
assert '我的记录' in request(player,'/records')
server.shutdown();D.cleanup();print('PASS: register, login, QQ bind, admin credit, redeem, stock, refund, duplicate refund prevention, records')
