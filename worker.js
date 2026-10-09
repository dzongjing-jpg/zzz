const assets=/* ASSET_MAP */ {};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>Math.floor(Date.now()/1000);
const random=(n=32)=>Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>x.toString(16).padStart(2,'0')).join('');
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const sha=async v=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
export async function hashPassword(p,salt=random(16)){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);return salt+':'+hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},k,256));}
function equal(a,b){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
const hidden=(name,v)=>`<input type="hidden" name="${esc(name)}" value="${esc(v)}">`;
const field=(label,name,type='text',attrs='')=>`<label>${label}<input name="${name}" type="${type}" ${attrs}></label>`;
const productImage=p=>p.image_key?`<img src="/product-images/${esc(p.image_key)}" alt="${esc(p.title)}" loading="lazy">`:esc(p.emoji);
const imageField=(required=false)=>field('商品图片','image','file',`accept="image/jpeg,image/png,image/webp,image/gif" ${required?'required':''}`)+'<small>支持 JPG、PNG、WebP、GIF，单张不超过2MB。</small>';
const rewardFields=(v={})=>field('名称','title','text',`required maxlength="80" value="${esc(v.title)}"`)+field('说明','description','text',`maxlength="300" value="${esc(v.description)}"`)+imageField()+field('备用图标（未上传图片时使用）','emoji','text',`value="${esc(v.emoji??'🎁')}" maxlength="8"`)+field('帮贡价格','cost','number',`required min="1" max="10000000" value="${esc(v.cost)}"`)+field('库存','stock','number',`required min="0" max="10000000" value="${esc(v.stock)}"`);
class ImageUploadError extends Error{}
async function saveProductImage(file,env){
 if(file.size>2*1024*1024)throw new ImageUploadError('图片不得超过2MB，请选择较小的图片');
 const bytes=new Uint8Array(await file.arrayBuffer()),text=(a,b)=>String.fromCharCode(...bytes.slice(a,b));
 let ext,type;
 if(bytes.length>=24&&bytes.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i])&&text(12,16)==='IHDR'){ext='png';type='image/png';}
 else if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255){ext='jpg';type='image/jpeg';}
 else if(bytes.length>=13&&['GIF87a','GIF89a'].includes(text(0,6))){ext='gif';type='image/gif';}
 else if(bytes.length>=16&&text(0,4)==='RIFF'&&text(8,12)==='WEBP'){ext='webp';type='image/webp';}
 else throw new ImageUploadError('图片格式不支持，请上传有效的 JPG、PNG、WebP 或 GIF 图片');
 if(!env.BUCKET)throw Error('Image storage unavailable');
 const key=random(24)+'.'+ext;await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});return key;
}
const form=(action,body,csrf,label)=>`<form method="post" action="${action}"${['/admin/product','/admin/product-image'].includes(action)?' enctype="multipart/form-data"':''}>${hidden('csrf',csrf)}${body}<p><button class="btn">${label}</button></p></form>`;
const panel=(title,body)=>`<section class="panel"><h2>${title}</h2>${body}</section>`;
const table=(heads,rows)=>`<div class="scroll"><table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${heads.length}" class="muted">暂无记录</td></tr>`}</tbody></table></div>`;
const statusLabel=s=>({pending:'待发放',fulfilled:'已发放',refunded:'已拒绝退款'}[s]||esc(s));
function layout(title,body,u,s,msg=''){
const menu=u?`<a href="/">商城</a><a href="/records">我的记录</a>${u.role==='admin'?'<a href="/admin">管理后台</a>':''}<form class="inline" method="post" action="/logout">${hidden('csrf',s.csrf)}<button class="navlink">退出登录</button></form>`:'<a href="/login">登录</a><a href="/register">注册</a>';
return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="灵台方寸山帮会积分兑换中心"><title>${esc(title)} · 方寸山帮贡兑换阁</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23120e0b'/%3E%3Cpath d='M16 3L29 16 16 29 3 16Z' fill='%23f1cc86'/%3E%3Cpath d='M16 9L23 16 16 23 9 16Z' fill='%23741b16'/%3E%3C/svg%3E"><style>/* ORIGINAL_CSS */</style></head><body><div class="top-strip"><div class="wrap"><span><i class="status-dot"></i>天书奇谈 · 灵台方寸山</span><span>帮会专属兑换中心 · 积善成贡，以贡易宝</span></div></div><header><div class="wrap"><a href="/" class="brand"><img src="/assets/guild-logo.png" alt="灵台方寸山帮会标识" width="70" height="58"><span><strong>灵台方寸山</strong><small>天书不老 · 兄弟常在</small></span></a><nav>${menu}</nav></div></header><main class="wrap">${msg?`<div role="status" class="alert">${esc(msg)}</div>`:''}${body}</main><footer>帮会专用积分兑换系统 · 奖励以管理员最终发放为准</footer></body></html>`;
}
const html=(body,status=200)=>new Response(body.replace('</body>','<script src="/webmcp.js" defer></script></body>'),{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
const redirect=(path,msg='',cookie='')=>new Response(null,{status:303,headers:{Location:path+(msg?'?msg='+encodeURIComponent(msg):''),'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
const cookie=t=>`sid=${t}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${t?604800:0}`;
function database(env){if(!env.DB)throw Error('Database unavailable');return {q:(sql,...args)=>env.DB.prepare(sql).bind(...args),one:(sql,...args)=>env.DB.prepare(sql).bind(...args).first(),all:async(sql,...args)=>(await env.DB.prepare(sql).bind(...args).all()).results,run:(sql,...args)=>env.DB.prepare(sql).bind(...args).run(),batch:items=>env.DB.batch(items)};}
export const demoProducts=[['一等上古碎片','游戏内人工发放',500,10,'💎'],['随机变身卡','游戏内人工发放',300,20,'🎴'],['游戏银两','数量由管理员确认',1000,5,'🪙'],['神兽抽奖资格','按帮会规则参与抽奖',2000,3,'🐉']];
async function seed(d,env){
 if(!env.ADMIN_PASSWORD_HASH&&!await d.one("SELECT id FROM users WHERE role='admin' LIMIT 1"))throw Error('Administrator initialization is required');
 if(env.ADMIN_PASSWORD_HASH)await d.run("INSERT OR IGNORE INTO users(id,username,password_hash,role,verified) VALUES(1,'admin',?,'admin',1)",env.ADMIN_PASSWORD_HASH);
 if(env.SEED_DEMO_PRODUCTS!=='0')await d.batch(demoProducts.map((p,i)=>d.q('INSERT OR IGNORE INTO products(id,title,description,cost,stock,emoji) VALUES(?,?,?,?,?,?)',i+1,...p)));
}
async function dispatch(req,env){
 const transportUrl=new URL(req.url);
 if(transportUrl.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(transportUrl.hostname)){transportUrl.protocol='https:';return Response.redirect(transportUrl.href,308);}
 const asset=assets[new URL(req.url).pathname];if(asset&&req.method==='GET'){const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));return new Response(bytes,{headers:{'Content-Type':asset.type,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});}
 if(new URL(req.url).pathname==='/webmcp.js')return new Response(`if(document.modelContext?.registerTool){document.modelContext.registerTool({name:'read_current_exchange_page',description:'读取当前页面上可见的商城商品或本人记录，不进行兑换或更改数据。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async()=>({content:[{type:'text',text:document.querySelector('main').innerText}]})});}`,{headers:{'Content-Type':'application/javascript; charset=utf-8','X-Content-Type-Options':'nosniff'}});
 const url=new URL(req.url),path=url.pathname,d=database(env);
 if(path.startsWith('/product-images/')&&req.method==='GET'){
 const key=path.slice('/product-images/'.length);if(!/^[a-f0-9]{48}\.(png|jpg|gif|webp)$/.test(key)||!await d.one('SELECT id FROM products WHERE image_key=? LIMIT 1',key))return new Response('Not found',{status:404});
 const object=await env.BUCKET?.get(key);if(!object)return new Response('Not found',{status:404});
 const types={png:'image/png',jpg:'image/jpeg',gif:'image/gif',webp:'image/webp'};
 return new Response(object.body,{headers:{'Content-Type':types[key.split('.').pop()],'Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
 }
 if(path==='/health'){await d.one('SELECT 1 FROM users LIMIT 1');return new Response('OK');}
 await seed(d,env);
 const sid=(req.headers.get('cookie')||'').match(/(?:^|;\s*)sid=([a-f0-9]+)/)?.[1]||'';
 const s=sid?await d.one('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?',await sha(sid),now()):null;
 const u=s?await d.one("SELECT users.*,(SELECT COALESCE(SUM(cost),0) FROM orders WHERE user_id=users.id AND status IN ('pending','fulfilled')) AS spent FROM users WHERE id=?",s.user_id):null,csrf=s?.csrf||'';
 const page=(title,body,status=200)=>html(layout(title,body,u,s,url.searchParams.get('msg')||''),status);
 if(req.method==='GET'){
 if(path==='/'){
 const ps=await d.all('SELECT * FROM products WHERE active=1 ORDER BY id DESC');
 const account=u?`<div><div class="muted">当前可用帮贡</div><div class="big gold">${u.balance.toLocaleString()}</div></div><div class="points-breakdown"><div>游戏帮贡：<b>${u.game_total===null?'尚未录入':u.game_total.toLocaleString()}</b> − 本站已用：<b>${u.spent.toLocaleString()}</b></div><small>已用包含待发放与已发放订单，已退款订单不计入。</small><div>角色：${esc(u.character_name||'未绑定')} · QQ：${esc(u.qq||'未绑定')}</div></div>`:'<div><div class="guest-copy">仙友，请先入阁登录</div><div class="guest-sub">绑定QQ后，即可查看帮贡余额、兑换心仪宝物。</div></div><a href="/login">登录兑换阁 →</a>';
 return page('商城',`<section class="hero"><div class="gold">✦ 天书奇谈 · 灵台方寸山 · 帮会珍藏 ✦</div><h1>帮贡兑换阁</h1><div class="muted">积善成贡 · 以贡易宝</div><div class="hero-seal">方寸同门 · 以贡相赠</div></section><div class="panel account-panel">${account}</div><div class="section-heading"><h2>阁中珍宝</h2><span>帮贡兑换 · 管理员核验发放</span></div><div class="grid">${ps.map(p=>`<article class="product"><div class="pic ${p.image_key?'has-image':''}">${productImage(p)}</div><h3>${esc(p.title)}</h3><div class="muted">${esc(p.description)}</div><p class="gold"><b>${p.cost} 帮贡</b> · 库存 ${p.stock}</p><form method="post" action="/redeem">${hidden('csrf',csrf)}${hidden('id',p.id)}<button class="btn" ${!u?.verified||p.stock<1||u.balance<p.cost?'disabled':''}>兑换</button></form></article>`).join('')}</div>${u&&!u.verified?'<div class="panel">尚未绑定验证QQ，<a href="/bind">前往绑定</a>。请向管理员领取验证码。</div>':''}`);
 }
 if(path==='/login'||path==='/register'){const title=path==='/login'?'登录':'注册';return page(title,`<div class="panel form"><h1>${title}</h1>${form(path,field('用户名','username','text','required minlength="3" maxlength="40" autocomplete="username"')+field('密码','password','password',`required minlength="6" maxlength="128" autocomplete="${path==='/login'?'current-password':'new-password'}"`),'',title)}</div>`);}
 if(!u)return redirect('/login');
 if(path==='/bind')return page('绑定QQ',`<div class="panel form"><h1>绑定QQ与游戏角色</h1><p class="muted">联系帮会管理员领取一次性验证码，有效期30分钟。QQ与角色名仅用于帮会核对和奖励发放；请勿填写QQ密码。</p>${form('/bind',field('QQ号码','qq','text','required inputmode="numeric" pattern="[1-9][0-9]{4,11}"')+field('绑定验证码','code','text','required maxlength="24"'),csrf,'完成绑定')}</div>`);
 if(path==='/records'){
 const os=await d.all('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 100',u.id),ls=await d.all('SELECT * FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 100',u.id);
 return page('我的记录','<h1>我的记录</h1>'+panel('兑换订单',table(['订单','奖励','花费','状态','时间'],os.map(o=>['#'+o.id,esc(o.product_title),o.cost,statusLabel(o.status),esc(o.created_at)])))+panel('帮贡流水',table(['时间','变动','余额','原因'],ls.map(l=>[esc(l.created_at),(l.delta>0?'+':'')+l.delta,l.balance_after,esc(l.reason)]))));
 }
 if(path==='/admin'){
 if(u.role!=='admin')return page('无权限','<h1>无管理员权限</h1>',403);
 const us=await d.all("SELECT users.*,(SELECT COALESCE(SUM(cost),0) FROM orders WHERE user_id=users.id AND status IN ('pending','fulfilled')) AS spent FROM users ORDER BY id DESC LIMIT 200"),os=await d.all('SELECT orders.*,users.username,users.qq FROM orders JOIN users ON users.id=orders.user_id ORDER BY orders.id DESC LIMIT 100'),ps=await d.all('SELECT * FROM products ORDER BY id DESC'),cs=await d.all('SELECT * FROM bind_codes ORDER BY id DESC LIMIT 20');
 const action=(path,label,fields)=>form(path,Object.entries(fields).map(([k,v])=>hidden(k,v)).join(''),csrf,label);
 const bind=panel('生成绑定验证码',form('/admin/code',field('玩家QQ号','qq','text','required pattern="[1-9][0-9]{4,11}"')+field('游戏角色名','character','text','required maxlength="60"'),csrf,'生成一次性验证码'));
 const points=panel('更新游戏帮贡',form('/admin/sync-points',`<p class="muted">填写游戏里最新显示的帮贡总数。系统自动扣除本站已兑换的帮贡，重复录入同一数值不会重复增加余额。</p><label>角色 / 玩家<select name="user_id">${us.map(p=>`<option value="${p.id}">${esc(p.character_name||p.username)} · ${esc(p.username)} / QQ ${esc(p.qq||'未绑定')} · 已用 ${p.spent}</option>`).join('')}</select></label>`+field('游戏中最新帮贡总数','game_total','number','required min="0" max="1000000000" step="1" placeholder="例如：18000"')+field('备注（可选）','reason','text','maxlength="120" placeholder="例如：本周帮贡截图"'),csrf,'更新并自动计算余额'));

 const add=panel('添加奖励',form('/admin/product',rewardFields(),csrf,'添加奖励'));
 return page('管理后台','<h1>帮会管理后台</h1><div class="grid">'+bind+points+add+'</div>'+panel('兑换订单',table(['订单','玩家','商品','状态','操作'],os.map(o=>['#'+o.id,esc(o.username)+'<br><small>'+esc(o.qq)+'</small>',esc(o.product_title)+' · '+o.cost,statusLabel(o.status),o.status==='pending'?action('/admin/order','确认发放',{id:o.id,status:'fulfilled'})+action('/admin/order','拒绝并退款',{id:o.id,status:'refunded'}):'—'])))+panel('奖励管理',table(['ID','奖励','帮贡','库存','状态','操作'],ps.map(p=>[p.id,`<div class="admin-product-image">${productImage(p)}</div>${esc(p.title)}`,p.cost,p.stock,p.active?'上架':'下架',action('/admin/toggle',p.active?'下架':'上架',{id:p.id})+form('/admin/product-image',hidden('id',p.id)+imageField(true),csrf,'更新图片')])))+panel('成员列表',table(['用户名','QQ','角色','游戏帮贡','本站已用','可用余额','最近更新（UTC）','绑定状态'],us.map(p=>[esc(p.username),esc(p.qq),esc(p.character_name),p.game_total===null?'未录入':p.game_total,p.spent,p.balance,esc(p.game_synced_at||'—'),p.verified?'已验证':'未验证'])))+panel('最近绑定验证码记录',table(['QQ','角色','过期时间','状态'],cs.map(c=>[esc(c.qq),esc(c.character_name),esc(new Date(c.expires_at*1000).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})),c.used_at?'已使用':'未使用'])))+panel('修改管理员密码',form('/admin/password',field('当前密码','current','password','required autocomplete="current-password"')+field('新密码','password','password','required minlength="6" maxlength="128" autocomplete="new-password"'),csrf,'修改密码')));
 }
 return page('404','<h1>页面不存在</h1>',404);
 }
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 if(req.headers.get('origin')&&req.headers.get('origin')!==url.origin||req.headers.get('sec-fetch-site')==='cross-site')return page('安全校验失败','<h1>请从本站提交表单</h1>',403);
 const uploadRoute=['/admin/product','/admin/product-image'].includes(path);
 if(uploadRoute&&(!u||u.role!=='admin'))return page('无权限','<h1>仅管理员可以上传商品图片</h1>',403);
 const limit=uploadRoute?2*1024*1024+20000:20000;
 if(Number(req.headers.get('content-length')||0)>limit)return page('文件过大','<h1>图片不得超过2MB</h1><a href="/admin">返回后台</a>',413);
 let f={},upload=null;
 try{
 const chunks=[];let size=0;const reader=req.body?.getReader();
 if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();return page('文件过大','<h1>图片不得超过2MB</h1><a href="/admin">返回后台</a>',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 if(uploadRoute&&req.headers.get('content-type')?.startsWith('multipart/form-data')){
 const data=await new Response(bytes,{headers:{'content-type':req.headers.get('content-type')}}).formData();
 for(const [key,value] of data){if(typeof value==='string'){if(value.length>2000)throw Error('字段过长');f[key]=value;}else if(key==='image'&&value.size)upload=value;}
 }else f=Object.fromEntries(new URLSearchParams(new TextDecoder().decode(bytes)));
 }catch{return page('提交失败','<h1>表单格式不正确，请重新选择图片</h1><a href="/admin">返回后台</a>',400);}
 const ip=req.headers.get('cf-connecting-ip')||'unknown';
 const limited=async key=>{await d.run('DELETE FROM login_attempts WHERE created_at<?',now()-900);const r=await d.run('INSERT INTO login_attempts(ip,created_at) SELECT ?,? WHERE (SELECT COUNT(*) FROM login_attempts WHERE ip=?)<12',key,now(),key);return !r.meta.changes;};
 if(path==='/register'){
 const name=(f.username||'').trim(),pw=f.password||'';
 if(!/^[a-zA-Z0-9_]{3,40}$/.test(name)||pw.length<6||pw.length>128)return redirect('/register','用户名仅限英数字下划线，密码6至128位');
 if(await limited('register:'+ip))return redirect('/register','操作过多，15分钟后重试');
 const r=await d.run('INSERT OR IGNORE INTO users(username,password_hash) VALUES(?,?)',name,await hashPassword(pw));
 return redirect(r.meta.changes?'/login':'/register',r.meta.changes?'注册成功，请登录':'用户名已被占用');
 }
 if(path==='/login'){
 if(await limited('login:'+ip))return redirect('/login','登录尝试过多，15分钟后重试');
 const p=await d.one('SELECT * FROM users WHERE username=?',f.username||'');
 if(!p||!f.password||f.password.length>128||!equal(await hashPassword(f.password,p.password_hash.split(':')[0]),p.password_hash))return redirect('/login','用户名或密码错误');
 const t=random();await d.batch([d.q('DELETE FROM login_attempts WHERE ip=?','login:'+ip),d.q('DELETE FROM sessions WHERE expires_at<?',now()),d.q('INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)',await sha(t),p.id,random(24),now()+604800)]);
 return redirect(!p.verified&&p.role!=='admin'?'/bind':'/','',cookie(t));
 }
 if(!u)return redirect('/login');
 if(!equal(f.csrf||'',csrf))return page('安全校验失败','<h1>表单已过期，请刷新后再试</h1>',403);
 if(path==='/logout'){await d.run('DELETE FROM sessions WHERE token_hash=?',await sha(sid));return redirect('/login','',cookie(''));}
 if(path==='/bind'){
 if(await limited('bind:'+u.id))return redirect('/bind','尝试过多，15分钟后重试');
 const qq=(f.qq||'').trim();if(!/^[1-9][0-9]{4,11}$/.test(qq))return redirect('/bind','QQ号码格式不正确');
 try{const [r]=await d.batch([d.q('UPDATE users SET qq=?,character_name=(SELECT character_name FROM bind_codes WHERE qq=? AND code_hash=? AND used_at IS NULL AND expires_at>? ORDER BY id DESC LIMIT 1),verified=1 WHERE id=? AND verified=0 AND EXISTS(SELECT 1 FROM bind_codes WHERE qq=? AND code_hash=? AND used_at IS NULL AND expires_at>?)',qq,qq,await sha((f.code||'').trim()),now(),u.id,qq,await sha((f.code||'').trim()),now()),d.q('UPDATE bind_codes SET used_at=? WHERE qq=(SELECT qq FROM users WHERE id=? AND verified=1) AND used_at IS NULL',now(),u.id)]);return redirect(r.meta.changes?'/':'/bind',r.meta.changes?'绑定成功':'绑定码无效、已过期或当前账号已绑定');}catch{return redirect('/bind','QQ已被其他账号使用');}
 }
 if(path==='/redeem'){
 if(!u.verified)return redirect('/bind','请先验证QQ绑定');
 try{const key=random();const [r]=await d.batch([
 d.q("INSERT INTO orders(user_id,product_id,product_title,cost,note) SELECT ?,id,title,cost,? FROM products WHERE id=? AND active=1 AND stock>0 AND cost<=(SELECT balance FROM users WHERE id=? AND verified=1)",u.id,key,Number(f.id)||0,u.id),
 d.q('UPDATE users SET balance=balance-(SELECT cost FROM orders WHERE note=?) WHERE id=? AND EXISTS(SELECT 1 FROM orders WHERE note=?)',key,u.id,key),
 d.q('UPDATE products SET stock=stock-1 WHERE id=(SELECT product_id FROM orders WHERE note=?)',key),
 d.q("INSERT INTO ledger(user_id,delta,balance_after,reason,actor_id,order_id,operation_key) SELECT o.user_id,-o.cost,u.balance,'兑换 '||o.product_title,o.user_id,o.id,? FROM orders o JOIN users u ON u.id=o.user_id WHERE o.note=?",key,key)
 ]);return redirect('/records',r.meta.changes?'兑换提交成功，等待管理员发放':'帮贡不足、库存不足或奖励已下架');}catch{return redirect('/','兑换未完成，请刷新后重试');}
 }
 if(u.role!=='admin')return page('无权限','<h1>无管理员权限</h1>',403);
 if(path==='/admin/code'){
 const qq=(f.qq||'').trim(),character=(f.character||'').trim();if(!/^[1-9][0-9]{4,11}$/.test(qq)||!character||character.length>60)return redirect('/admin','QQ或角色名格式不正确');
 if(await d.one('SELECT id FROM users WHERE qq=?',qq))return redirect('/admin','该QQ已绑定');
 const code=random(5).toUpperCase();await d.batch([d.q('UPDATE bind_codes SET used_at=? WHERE qq=? AND used_at IS NULL',now(),qq),d.q('INSERT INTO bind_codes(qq,character_name,code_hash,expires_at,created_by) VALUES(?,?,?,?,?)',qq,character,await sha(code),now()+1800,u.id)]);
 return page('绑定验证码',panel('一次性绑定码',`<p>QQ：${esc(qq)} / 角色：${esc(character)}</p><div class="big gold">${code}</div><p>有效期30分钟，仅展示一次。请通过可信渠道私下发给对应玩家。</p><a class="btn secondary" href="/admin">返回后台</a>`));
 }
 if(path==='/admin/sync-points'){
 const uid=Number(f.user_id),total=Number(f.game_total),reason=(f.reason||'').trim();
 if(!Number.isSafeInteger(uid)||uid<1||!/^\d+$/.test(f.game_total||'')||!Number.isSafeInteger(total)||total<0||total>1e9||reason.length>120)return redirect('/admin','请选择玩家并填写0至10亿之间的整数帮贡');
 const key=random();
 // The snapshot, current order spend and balance update share one atomic batch.
 // Pending orders reserve points; refunds are excluded from net spend.
 const [r]=await d.batch([
 d.q("INSERT INTO ledger(user_id,delta,balance_after,reason,actor_id,operation_key) SELECT id,?-spent-balance,?-spent,'同步游戏帮贡：'||COALESCE(game_total,'首次录入')||' → '||?||'；本站已用 '||spent||?, ?,? FROM (SELECT users.*,(SELECT COALESCE(SUM(cost),0) FROM orders WHERE user_id=users.id AND status IN ('pending','fulfilled')) AS spent FROM users WHERE id=?) WHERE ?>=spent",total,total,total,reason?'；'+reason:'',u.id,key,uid,total),
 d.q('UPDATE users SET balance=(SELECT balance_after FROM ledger WHERE operation_key=?),game_total=?,game_synced_at=CURRENT_TIMESTAMP WHERE id=? AND EXISTS(SELECT 1 FROM ledger WHERE operation_key=?)',key,total,uid,key)
 ]);
 if(!r.meta.changes)return redirect('/admin','未更新：玩家不存在，或游戏帮贡低于本站已消耗帮贡。请核对数据；如游戏清零，请先核对历史兑换记录。');
 const result=await d.one('SELECT balance_after FROM ledger WHERE operation_key=?',key);
 return redirect('/admin',`游戏帮贡已更新为 ${total.toLocaleString()}，扣除本站已用后，可用余额为 ${result.balance_after.toLocaleString()}`);
 }
 if(path==='/admin/points'){
 const uid=Number(f.user_id),delta=Number(f.delta),reason=(f.reason||'').trim();if(!Number.isSafeInteger(uid)||!Number.isSafeInteger(delta)||!delta||Math.abs(delta)>1e7||!reason||reason.length>120)return redirect('/admin','请填写正确的变动值和原因');
 const key=random();const [r]=await d.batch([d.q('INSERT INTO ledger(user_id,delta,balance_after,reason,actor_id,operation_key) SELECT id,?,balance+?,?,?,? FROM users WHERE id=? AND balance+?>=0',delta,delta,reason,u.id,key,uid,delta),d.q('UPDATE users SET balance=balance+?,game_total=CASE WHEN game_total IS NULL THEN NULL ELSE game_total+? END WHERE id=? AND EXISTS(SELECT 1 FROM ledger WHERE operation_key=?)',delta,delta,uid,key)]);return redirect('/admin',r.meta.changes?'帮贡调整成功':'玩家不存在或扣减超过余额');
 }
 if(path==='/admin/product'){
 const title=(f.title||'').trim(),desc=(f.description||'').trim(),emoji=(f.emoji||'🎁').trim(),cost=Number(f.cost),stock=Number(f.stock);
 if(!title||title.length>80||desc.length>300||emoji.length>16||!Number.isSafeInteger(cost)||cost<1||cost>1e7||!Number.isSafeInteger(stock)||stock<0||stock>1e7)return redirect('/admin','商品字段无效');
 let key=null;
 try{if(upload)key=await saveProductImage(upload,env);await d.run('INSERT INTO products(title,description,cost,stock,emoji,image_key) VALUES(?,?,?,?,?,?)',title,desc,cost,stock,emoji,key);}
 catch(e){return page('添加未完成',panel('添加奖励',`<div class="alert">${esc(e instanceof ImageUploadError?e.message:'保存暂时失败，请先检查奖励列表再重试。图片需要重新选择。')}</div>`+form('/admin/product',rewardFields(f),csrf,'添加奖励')),e instanceof ImageUploadError?400:503);}
 return redirect('/admin','奖励已添加');
 }
 if(path==='/admin/product-image'){
 const id=Number(f.id);if(!Number.isSafeInteger(id)||!await d.one('SELECT id FROM products WHERE id=?',id))return redirect('/admin','奖励不存在');
 try{if(!upload)throw new ImageUploadError('请先选择要上传的图片');const key=await saveProductImage(upload,env);await d.run('UPDATE products SET image_key=? WHERE id=?',key,id);return redirect('/admin','商品图片已更新');}
 catch(e){return page('图片未更新',panel('更新商品图片',`<div class="alert">${esc(e instanceof ImageUploadError?e.message:'图片保存暂时失败，请稍后重新选择图片重试。')}</div>`+form('/admin/product-image',hidden('id',id)+imageField(true),csrf,'更新图片')),e instanceof ImageUploadError?400:503);}
 }
 if(path==='/admin/toggle'){await d.run('UPDATE products SET active=1-active WHERE id=?',Number(f.id)||0);return redirect('/admin','商品状态已切换');}
 if(path==='/admin/order'){
 if(!['fulfilled','refunded'].includes(f.status))return redirect('/admin','订单状态无效');
 const key=random(),items=[d.q("UPDATE orders SET status=?,actor_id=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'",f.status,u.id,key,Number(f.id)||0)];
 if(f.status==='refunded')items.push(
 d.q('UPDATE users SET balance=balance+(SELECT cost FROM orders WHERE note=?) WHERE id=(SELECT user_id FROM orders WHERE note=?)',key,key),
 d.q('UPDATE products SET stock=stock+1 WHERE id=(SELECT product_id FROM orders WHERE note=?)',key),
 d.q("INSERT INTO ledger(user_id,delta,balance_after,reason,actor_id,order_id,operation_key) SELECT o.user_id,o.cost,u.balance,'订单拒绝退款 #'||o.id,?,o.id,? FROM orders o JOIN users u ON u.id=o.user_id WHERE o.note=?",u.id,key,key));
 const [r]=await d.batch(items);return redirect('/admin',r.meta.changes?'订单处理成功':'订单已处理或不存在');
 }
 if(path==='/admin/password'){
 if(!f.password||f.password.length<6||f.password.length>128||!f.current||f.current.length>128||!equal(await hashPassword(f.current,u.password_hash.split(':')[0]),u.password_hash))return redirect('/admin','当前密码错误，或新密码不符合6至128位要求');
 await d.batch([d.q('UPDATE users SET password_hash=? WHERE id=?',await hashPassword(f.password),u.id),d.q('DELETE FROM sessions WHERE user_id=?',u.id)]);return redirect('/login','密码已修改，请重新登录',cookie(''));
 }
 return page('404','<h1>操作不存在</h1>',404);
}
export default {async fetch(req,env){try{return await dispatch(req,env);}catch(e){console.error('Request failed',e.message);return html(layout('暂时无法访问','<div class="panel"><h1>暂时无法完成操作</h1><p>请稍后刷新重试。提交后请先检查记录，避免重复操作。</p><a href="/">返回商城</a></div>',null,null),503);}}};
