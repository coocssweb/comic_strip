# 微信小程序登录与用户身份能力边界调研

- 调研议题：调研微信登录与用户身份能力边界
- 调研日期：2026-07-21
- 资料范围：仅使用微信开放文档、微信小程序官方审核规则等微信官方一手资料
- 边界：本文只记录平台能力、限制、合规约束及其对本项目用户领域模型的硬约束，不决定注册、业务会话、退出登录或账号注销方案，也不展开字段、API、页面和代码设计

## 结论摘要

1. 原生小程序登录提供的是微信侧身份标识和 `session_key`，不是完整的业务账号与业务会话。开发者服务器应基于微信身份标识建立自己的用户体系和自定义登录态。[小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)
2. `openid` 只在当前小程序内唯一；同一微信开放平台账号下的多个应用可用 `unionid` 识别同一微信用户。已绑定开放平台账号的小程序可通过登录流程取得 `unionid`，无需用户授权。[wx.login](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html)；[UnionID 机制说明](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/union-id.html)
3. `session_key` 的有效期由微信维护且对开发者透明，获取新的登录凭证还可能顶替旧 `session_key`。它是微信侧会话密钥，不应下发到小程序，也不能直接充当本项目业务会话。[wx.checkSession](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.checkSession.html)；[小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)
4. 微信身份标识与头像、昵称等用户资料是两类能力。用户资料能力不能替代身份标识，头像或昵称也不能作为用户唯一身份依据。[wx.getUserProfile](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserProfile.html)；[头像昵称填写](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html)
5. 微信要求涉及个人信息处理的小程序配置隐私保护指引；只有已声明的信息类型才能调用对应隐私接口或组件，并需同步用户已经阅读并同意相关规则。该同意状态可能被清空，不能作为稳定身份或业务账号状态。[小程序隐私协议开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)
6. 微信审核规则要求：用户注销账号后，应相应删除相关数据；但本次核验的官方资料没有替开发者定义退出登录和业务账号注销的具体流程。[小程序审核常见被拒绝情形](https://developers.weixin.qq.com/miniprogram/product/reject.html)
7. 在本次核验的微信官方登录、会话、隐私与审核资料中，未发现由微信平台统一代办“小程序业务账号注销”的能力说明。本文不据此断言平台绝对不存在该能力；本项目的具体注销策略仍需在后续决策议题中确定。

## 一、官方事实

### 1. 原生登录与身份标识

- `wx.login` 获取临时登录凭证 `code`。该凭证有效期为五分钟；官方登录流程同时说明 `code` 只能使用一次。[wx.login](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html)；[小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)
- `code` 应传给开发者服务器，由服务器调用 `code2Session` 完成登录凭证校验。该接口明确要求在服务器端调用，不可由小程序前端直接调用。[小程序登录凭证校验](https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_code2session.html)
- 登录凭证校验可返回当前小程序内的用户唯一标识 `openid`、满足条件时返回的 `unionid`，以及本次登录的会话密钥 `session_key`。[wx.login](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html)；[小程序登录凭证校验](https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_code2session.html)
- 微信官方登录流程把“开发者服务器根据用户标识生成自定义登录态”交给开发者负责。微信没有用 `session_key` 替代开发者自己的业务登录态。[小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)
- `openid` 的唯一范围是“用户在当前小程序”；不能把同一微信用户在不同小程序中的 `openid` 默认视为相同。[wx.login](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html)
- 同一微信开放平台账号下的移动应用、网站应用、小程序、公众号等应用中，同一用户的 `unionid` 唯一。已绑定开放平台账号的小程序可以直接通过 `wx.login` 与 `code2Session` 获取 `unionid`，无需用户授权。[UnionID 机制说明](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/union-id.html)
- `wx.getUserProfile` 返回的加密数据不包含 `openid` 和 `unionid`；头像昵称填写能力用于用户主动完善资料。身份识别与资料完善不能混为同一能力。[wx.getUserProfile](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserProfile.html)；[头像昵称填写](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html)

### 2. `session_key` 的续期、校验与失效

- `session_key` 具有唯一性：同一用户在同一小程序中，同一时刻只有一个有效的 `session_key`。[wx.checkSession](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.checkSession.html)；[检验登录态](https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_checksessionkey.html)
- `session_key` 有时效性，但具体时效逻辑由微信维护，对开发者透明。用户越久未使用小程序，登录态越可能过期；持续使用时可能保持有效。因此不能依赖一个由项目自行假定的固定有效期。[wx.checkSession](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.checkSession.html)
- 除自然过期外，触发获取新 `code` 的操作也可能生成新的 `session_key`，顶替并使旧 `session_key` 失效。[wx.checkSession](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.checkSession.html)；[检验登录态](https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_checksessionkey.html)
- 小程序端 `wx.checkSession` 校验的是最后一次获取 `code` 所对应的 `session_key`；如果服务器需要校验指定的 `session_key`，微信另提供服务端检验登录态能力。[wx.checkSession](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.checkSession.html)；[检验登录态](https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_checksessionkey.html)
- 登录态失效后，官方给出的恢复路径是重新调用 `wx.login` 获取新的登录态。[wx.checkSession](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.checkSession.html)
- 微信提供重置 `session_key` 的服务端能力，但重置后的 `session_key` 继承原有过期时间，不能用于续期；旧 `session_key` 会失效，且官方不允许频繁重置同一用户的登录态。[重置登录态](https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_resetusersessionkey.html)
- `session_key` 是用户数据加密签名密钥。开发者服务器不应将其下发到小程序，也不应对外提供。[小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)

### 3. 隐私授权边界

- 涉及处理用户个人信息的小程序需要在管理后台配置《小程序用户隐私保护指引》。只有在指引中声明了所处理的信息，才能调用微信提供的对应隐私接口或组件；未声明时，对应能力会被禁用。[小程序隐私协议开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)
- 对每个用户，开发者需同步其已经阅读并同意小程序的隐私政策等收集使用规则，之后才能调用已声明的隐私接口或组件。[小程序隐私协议开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)
- 用户从微信“最近使用的小程序”中删除该小程序后，历史隐私同意同步状态会被清空；下次访问时需重新同步。[小程序隐私协议开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)
- `unionid` 的获取规则明确说明：小程序绑定开放平台账号后，可通过登录流程获取，且无需用户授权。这项事实只说明取得该微信身份标识不依赖用户资料授权，不免除开发者对实际个人信息处理行为的告知、声明和合规责任。[UnionID 机制说明](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/union-id.html)；[小程序隐私协议开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)
- `wx.getUserProfile` 需要在用户点击事件后调用，每次请求都会显示授权窗口；用户同意后才返回用户资料。[wx.getUserProfile](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserProfile.html)

### 4. 退出登录与账号注销边界

- 微信审核规则规定：收集和使用用户数据时必须明确告知用途、取得明确同意和授权，并在用户注销账号后相应删除相关数据。[小程序审核常见被拒绝情形](https://developers.weixin.qq.com/miniprogram/product/reject.html)
- 微信的“重置登录态”只重置 `session_key`，并会返回新的 `session_key`，而且不会延长其有效期。因此它不等同于退出本项目业务会话，更不等同于注销本项目业务账号。[重置登录态](https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_resetusersessionkey.html)
- 从微信“最近使用的小程序”中删除小程序，只会清空官方文档所述的隐私同意同步状态；官方资料没有把该操作定义为注销开发者的业务账号。[小程序隐私协议开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)
- 本次核验的官方资料没有给出由微信平台统一代办开发者业务账号注销的接口或流程，也没有说明业务账号注销会删除、变更或释放 `openid`/`unionid`。这两点均应视为“未发现官方依据”，不能反向推导其一定存在或一定不存在。

## 二、对本项目用户领域模型的硬约束

以下约束由上述官方事实直接导出，不代表具体实现方案：

1. **微信身份与业务用户必须分层。** `openid`/`unionid` 是微信平台身份标识；本项目用户及其注册状态、业务会话、注销状态属于项目自己的业务事实。不能把 `session_key` 或隐私同意状态直接当成业务用户。
2. **当前小程序内的稳定外部身份依据只能以 `openid` 为基础。** 头像、昵称不是唯一标识，也不能用于合并用户；用户资料缺失不应改变微信身份识别结果。
3. **跨应用身份打通只能建立在满足条件的 `unionid` 上。** 只有应用属于同一微信开放平台账号并实际取得 `unionid` 时，才能据此识别跨应用的同一微信用户；不能假定每次登录必然返回 `unionid`。
4. **微信侧会话与业务侧会话必须分开。** `session_key` 只能由可信服务器保管，其生命周期不透明，且可能因再次获取 `code` 被顶替；本项目不得把它直接暴露给小程序或承诺固定有效期。
5. **业务会话不能依赖重置 `session_key` 完成续期或退出。** 官方重置能力不会续期，并会产生新的 `session_key`。本项目的会话签发、续期、撤销和退出范围必须由后续决策明确。
6. **隐私同意状态与用户身份、注册状态相互独立。** 同意状态可因用户删除最近使用记录而清空，但微信身份标识并未因此被官方定义为失效；不得把重新隐私授权误判为新用户注册。
7. **退出登录与账号注销是不同业务动作。** 微信的重置 `session_key` 和删除最近使用记录均未被官方定义为业务账号注销；注销还触发相关数据删除责任，不能用这些平台操作代替。退出登录的作用范围由本项目后续决定。
8. **业务账号注销不能被描述为注销微信账号。** 本项目无权删除或变更微信平台账号，也没有官方依据表明业务注销会释放 `openid`/`unionid`。后续重新进入时如何处理同一平台标识，必须由本项目明确决定。
9. **业务账号注销后必须承担相关数据处理责任。** 具体保留、删除或依法例外处理的范围尚未由本次微信官方资料充分定义，不能在本议题中自行扩展结论；退出登录能力及其作用范围也留待后续决策。

## 三、仍需后续产品决策的事项

下列事项不由微信平台替项目决定，应留给“决定微信用户注册、会话与注销流程”议题：

- 首次取得微信身份标识时，是立即建立业务用户，还是在用户触发需要账号的行为时再建立。
- 本项目是否仅以当前小程序为身份范围，还是存在跨公众号、其他小程序或其他应用统一身份的需求；若有，如何以 `unionid` 为前提处理。
- 业务会话的有效期、续期方式、多设备或多端并发规则，以及退出登录影响当前会话还是全部会话。
- 微信 `session_key` 失效但业务会话仍有效、或业务会话失效但微信 `session_key` 仍有效时，各自如何处理。
- 注销的发起条件、身份确认、是否设置冷静期、能否撤回，以及未完成业务或安全风险下是否暂缓注销。
- 注销后评论、点赞、收藏等漫画互动和其他用户数据如何删除、匿名化或保留；微信官方审核规则只给出了“相应删除相关数据”的原则，未替本项目划定具体数据边界。
- 注销后同一 `openid` 或 `unionid` 再次进入时，是恢复旧关系、建立全新业务用户，还是禁止一段时间内重新注册。
- 头像、昵称等资料是否需要收集、何时收集、是否允许跳过，以及隐私同意被清空后的降级行为。

## 四、已知资料缺口与结论置信度

- **高置信度：** 登录流程、`code` 限制、`openid`/`unionid` 作用域、`session_key` 保密与失效规则、隐私接口声明及同意机制、注销后的相关数据删除要求，均有对应微信官方文档直接说明。
- **中等置信度：** “微信不统一代办小程序业务账号注销”是对本次已核验官方资料的检索结果，不是微信官方的否定性声明。因此本文只记录“未发现统一代办能力”，不作绝对不存在的结论。
- **未核实：** 业务账号注销后 `openid`/`unionid` 是否会在任何特殊平台操作下发生变化，微信官方资料未在本次调研范围内给出明确生命周期承诺。
- **未覆盖：** 法律法规对特定数据的法定保存期限、未成年人数据、支付或争议数据的特殊要求，以及本项目实际业务数据分类。它们需要另行基于对应监管一手资料调研，不能从微信平台文档直接推导。

## 五、供后续决策使用的边界句

> 微信负责证明“当前访问者对应哪个微信平台用户”，本项目负责决定“何时形成业务用户、业务会话如何存续，以及用户退出或注销后本项目数据如何处理”。
