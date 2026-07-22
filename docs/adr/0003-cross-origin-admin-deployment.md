# 管理端与管理 API 采用同站跨源部署

React 管理端部署在 `https://apollo.example.com`，管理 API 部署在 `https://apis.example.com`。两者属于同站但跨源，管理端请求必须显式携带凭据，API 只允许精确来源 `https://apollo.example.com` 的凭据型 CORS，不使用通配来源；管理会话 Cookie 由 API 主机设置且不设置 `Domain`，避免凭据发送给管理端静态资源主机或其他兄弟子域。该拓扑接受额外的 CORS 与跨站请求伪造防护复杂度，以保持管理端静态托管和 API 部署边界独立。
