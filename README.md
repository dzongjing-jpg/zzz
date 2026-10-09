# 灵台方寸山 · 帮贡兑换阁

帮会积分兑换网站，包含玩家注册登录、QQ绑定码验证、帮贡同步、商品兑换、订单发放与退款、管理员后台及商品图片上传。

本仓库根目录是目前在线网站使用的 JavaScript Worker 版本。原始 Python 项目完整保留在 `legacy-python/`，仅作历史参考；它不包含后续新增功能。

## 已实现的功能

- 游戏帮贡同步：可用余额 = 最新录入的游戏帮贡 − 本站未退款订单消耗。
- 例如录入 13000，兑换消耗 2000 后剩 11000；再次录入游戏总数 18000，本站余额为 16000。
- 重复录入不会重复加分；待发放订单占用帮贡，退款返还帮贡和库存。
- JPG、PNG、WebP、GIF 商品图片上传与替换，单张最多 2MB；未上传时显示 emoji。
- 注册和修改密码至少 6 位，最多 128 位。
- 复古仙侠风界面，支持窄屏布局。
- 管理员权限、CSRF 校验、密码哈希、登录尝试限制、帮贡流水。

## 构建与测试

需要 Node.js 24 或更新版本及 pnpm。

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

构建结果为 `dist/server/index.js`，导出 Worker `fetch` 入口。测试使用隔离的临时数据库及图片存储替身，不连接在线数据库。

## 本机预览

```sh
pnpm build
pnpm preview
```

访问 `http://127.0.0.1:8094`。预览管理员为 `admin`，密码 `PreviewOnlyPassword123`，仅用于本机测试。预览使用独立 SQLite 文件，没有配置云端图片存储，因此不能验证真实图片上传。本机预览服务不可直接用作生产服务；线上会话使用 Secure Cookie，需要 HTTPS。

## 生产部署要求

GitHub 仓库负责保存代码。本项目有后端和数据库，不能仅通过 GitHub Pages 提供完整服务。

当前运行架构为 Cloudflare Workers 兼容的 JavaScript Worker，并需要以下运行配置：

| 名称 | 类型 | 用途 |
| --- | --- | --- |
| `DB` | D1 数据库绑定 | 玩家、商品、订单、流水与会话 |
| `BUCKET` | R2 对象存储绑定 | 商品图片 |
| `ADMIN_PASSWORD_HASH` | 服务端 Secret | 首次创建 `admin` 账号使用的密码哈希 |

部署前需在目标账号建立数据库和存储、按顺序应用 `drizzle/*.sql`、设置管理员密码哈希，再部署构建后的 Worker。不要将现有生产数据库重复初始化，也不要修改已经应用的迁移。

管理员密码哈希可使用 `worker.js` 导出的 `hashPassword()` 生成；不要把管理员明文密码或哈希提交到仓库。管理员首次访问时初始化；后台修改密码后不会被初始化值覆盖。

新部署默认不会携带旧网站的数据库、用户、兑换记录和图片，需要另行安排迁移。原在线网站的 ChatGPT 访问限制来自托管平台，本仓库代码不会自动在其他托管平台重建该访问限制。

如部署到普通 Linux 服务器，需要为 `DB` 和 `BUCKET` 提供对应的存储适配及生产 HTTP 服务，不能直接运行 Worker 文件或用历史 Python 版代替最新版。

官方参考：[Wrangler 配置](https://developers.cloudflare.com/workers/wrangler/configuration/)、[D1 数据库迁移](https://developers.cloudflare.com/d1/reference/migrations/)、[GitHub Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)。

## 文件结构

- `worker.js`：页面、路由、认证和兑换逻辑。
- `theme.css`、`assets/`：界面样式和帮会图片。
- `db/schema.ts`、`drizzle/`：数据库结构与版本化迁移。
- `build.mjs`：生成 Worker 构建产物。
- `tests.mjs`：密码、图片、帮贡同步、兑换和退款测试。
- `local-db.mjs`、`preview.mjs`：本机测试与预览。
- `legacy-python/`：原始项目归档。

## 数据与初始内容

源码不包含真实用户数据库、管理员密码、GitHub 凭据或托管平台密钥。初始四种商品为演示商品，正式使用前请在后台下架并添加实际奖励。QQ绑定为帮会人工验证，不是腾讯官方身份认证。
