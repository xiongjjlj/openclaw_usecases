insert into public.use_cases (id,title,summary,problem,workflow,repro_mode,repro_prompt,manual_steps,category,tags,tools,links,source_date,evidence_note,submitted_by,status,created_at,updated_at) values
('uc_beeclaw_trading','BeeClaw：以 OpenClaw 为执行内核的交易 Bot','BeeClaw 是 BeeTrade 发布的 OpenClaw 交易 Bot：既可在 beetrade.com 直接使用，也可通过 ClawHub 安装 skill 在自己的 OpenClaw 里复现。','BeeClaw 解决的是“交易想法到真实执行”的断层问题：它把聊天入口、策略执行、回执反馈和后续复盘串成一条连续链路，让交易自动化从概念演示走向可持续使用。','1) 通过 beetrade.com 直接体验聊天触发交易执行。
2) 通过 ClawHub 安装 beetrade skill 到 OpenClaw。
3) 完成鉴权后运行回测与实盘策略。
4) 基于回执和结果迭代策略与风控。','install-first（ClawHub / BeeTrade Web）','','路径 A（产品使用）：
- 打开 https://beetrade.com 并按页面引导体验。

路径 B（本地复现）：
- 在 ClawHub 安装 beetrade skill（参考帖子中的 ClawHub 链接）。
- 终端执行：clawhub install beetrade
- 完成鉴权：beecli auth login
- 策略回测：beecli strategies backtest my-strategy
- 策略实盘：beecli strategies live my-strategy

说明：该案例复现重点是安装与接入链路，不是单条 Prompt。','交易与预测市场','["trading", "bot", "long-run"]','["cron", "browser", "message"]','["https://x.com/BeeTradeHQ/status/2029080724121563316", "https://beetrade.com", "https://clawhub.ai"]','2026-03-08','按原帖正文提取（X oEmbed），避免主观改写。','bear','published','2026-03-09T04:30:00.000Z','2026-03-09T08:52:35Z'),
('uc_mission_control','Mission Control：可视化运维 Case','Mission Control 是 OpenClaw 多代理系统的可视化控制台案例：以 Next.js + Convex 等技术栈构建监控与控制中枢。','多代理运行常见问题是状态不可见、协同弱、故障与成本难以及时发现和处置。','1) 构建实时看板并汇总代理/任务状态。
2) 统一监控并识别异常。
3) 执行控制动作（任务/服务层）。
4) 基于可视化反馈持续优化效率与成本。','prompt-first（先搭 Mission Control 看板，再接入真实数据）','Build a mission control dashboard for OpenClaw agents with Next.js 15 + Convex + Tailwind v4 + Framer Motion + ShadCN + Lucide + TypeScript. Focus on monitor-and-control workflows and realtime status.','1) 初始化 Next.js 15 + TypeScript。
2) 集成 Tailwind v4、Framer Motion、ShadCN、Lucide。
3) 配置 Convex 并接入代理状态流。
4) 实现监控 + 控制主界面。
5) 在真实多代理场景验证可观测性和协同效果。','运维与部署','["ops", "dashboard"]','["nodes", "cron", "message"]','["https://x.com/GoSailGlobal/status/2022529869050187828", "https://x.com/ziwenxu_/status/2029023693154742608"]','2026-03-04','按两条 X 帖技术栈与问题陈述整理。','bear','published','2026-03-09T04:31:00.000Z','2026-03-09T12:37:35Z'),
('uc_phone','OpenClaw Phone Case','ClawPhone 不是“手机里跑个聊天机器人”，而是把 OpenClaw 做成系统级手机操作层：可控 Launcher、私有应用分发、主机状态面板、上下文壁纸生成、语音/通知/生物认证交互都被串进一个可执行链路。','这个案例要解决的核心不是“能不能在手机上聊天”，而是“如何让 OpenClaw 持续控制和改造手机系统行为”。原帖里给的是完整系统改造清单：
- 自定义 Launcher 由 OpenClaw 经 API 全局控制
- 私有 mini app store（驻留在 Mac Studio）支持通过发消息触发新 App 生成与现有 App 更新，一键安装
- 原生 Kotlin 状态面板汇总宿主机进程/容器/dev server/tailscale/traefik/expo/kotlin 等状态
- 根据天气/位置/todo/日程/生日等上下文自动生成并设置壁纸
- 支持语音对话、读取通知/短信、播放媒体、弹出选项表单、请求指纹认证','阶段 A：设备与控制面
1) 在 Android 设备部署 OpenClaw Phone 基础运行环境。
2) 搭建并接入“可被 API 全控”的自定义 Launcher。

阶段 B：应用与状态闭环
3) 在 Mac Studio 侧搭建私有 mini app store，并打通“发消息 -> 生成/更新 App -> 一键安装”。
4) 开发原生 Kotlin 状态面板，实时展示主机与服务运行状态。

阶段 C：个性化与交互能力
5) 接入上下文信号（天气/位置/todo/事件/生日），自动生成并设置壁纸。
6) 打通语音、通知/短信读取、媒体控制、表单选择、指纹确认等交互能力。

阶段 D：验证与运营
7) 用真实日常任务连续跑 3-7 天，记录稳定性、误触发、交互延迟并迭代。','manual-first（系统改造 + 多组件联调）','','【最低可行复现（MVP）】
1) 先只复现“可控 Launcher + 消息触发动作”两件事。
2) 再加私有 app store 的“更新/安装”链路。
3) 最后接入 Kotlin 状态面板与系统交互（通知/媒体/认证）。

【验收清单】
- 能通过消息触发手机端动作
- 能通过消息触发 app 更新并一键安装
- 能在手机看到主机关键运行状态
- 能完成至少 3 类系统交互（语音/通知/媒体/指纹）

【不建议】
- 直接用“一条 Prompt”尝试复现全链路（会失败且难定位问题）','移动与可穿戴','["mobile", "agent"]','["nodes", "message"]','["https://x.com/thekitze/status/2020236618851103204", "https://x.com/marshallrichrds/status/2020034922304426237", "https://x.com/marshallrichrds/status/2020041410079051963"]','2026-02-07','已按原帖列出的5项系统能力与帖子内视频说明重写；此案例以系统改造流程为主，不是 Prompt 一键复现。','bear','published','2026-03-09T04:32:00.000Z','2026-03-09T12:42:01Z'),
('uc_bot_number','OpenClaw Bot：拥有号码并支持回复链路','OpenClaw Bot 拥有独立电话号码后，可被用户拨打，也能在同链路回呼与持续对话。','很多 Agent 仅单向推送，用户确认与执行容易脱节；号码链路把来电、回呼、追问放进同一入口。','1) 绑定可呼入/呼出的号码通道。
2) 建立来电号码与用户/任务上下文映射。
3) 通话中支持状态查询与下一步指令。
4) 高风险动作加确认门槛。
5) 通过同号码回传结果形成闭环记录。','semi-auto（号码接入 + 规则配置 + 人工验收）','你是 OpenClaw，复现“AI Agent 拥有电话号码并可回呼”的案例：识别来电用户并关联上下文，支持任务状态查询与下一步建议，高风险操作先确认后执行，通话结束后输出结构化记录。','1) 准备可呼入/呼出通道并绑定 Agent。
2) 配置语音工作流（接入→识别→执行→回传）。
3) 设定风险分级与二次确认。
4) 用 10+ 场景验收。
5) 复盘通话记录后再提升自动执行比例。','通信与号码 Bot','["bot", "conversation"]','["message", "voice_call"]','["https://x.com/RoundtableSpace/status/2021203748618477943", "https://x.com/scottjduffy/status/2018837091845902830"]','2026-02-10','依据两条 X 帖公开文案整理。','bear','published','2026-03-09T04:33:00.000Z','2026-03-09T12:37:35Z'),
('uc_polymarket','Polymarket Case','Polymarket 案例聚焦短周期市场监控与研究辅助：自动抓取数据、识别异常、输出风险清单。','预测市场变化快、噪音高，人工盯盘与手工响应滞后，难以稳定产出研究结论。','1) 定时抓取市场/价格/盘口数据。
2) 识别短时波动与异常。
3) 关联新闻/社媒做原因假设并标注证据。
4) 输出观察清单、风险提示、禁入条件。
5) 日终复盘并调整阈值。','semi-auto（数据抓取自动化 + 人工复核决策）','你是 OpenClaw。构建 Polymarket 研究助手：每5分钟抓取重点市场数据，标记异常并关联外部信息，输出《观察清单》《风险提示》《禁入条件》，明确仅用于研究辅助。','1) 配置只读数据访问。
2) 设置异常阈值。
3) 先跑 3-7 天纸面回放。
4) 人工抽样复核误报率。
5) 仅自动化研究输出，交易维持人工确认。','交易与预测市场','["polymarket", "research"]','["browser", "web_search", "cron"]','["https://x.com/Shelpid_WI3M/status/2023415099243851893", "https://docs.polymarket.com/api-reference/introduction", "https://docs.polymarket.com/developers/CLOB/introduction"]','2026-02-16','收益数字视为发布者自述，未作独立审计背书。','bear','published','2026-03-09T04:34:00.000Z','2026-03-09T12:37:35Z'),
('uc_multi_cua','多人协作 CUA：同频多代理 Case','多人协作 CUA 是 ClawCon 展示的 multi-player computer-use 案例：多个代理可在独立沙箱桌面并行运行。','传统 computer-use agent 往往独占单桌面，用户需要等待，难以并行多任务。','1) 为每个代理启动独立容器与桌面。
2) 代理通过 computer-use 工具执行 screenshot/click/type 等动作。
3) 宿主侧回传窗口流并执行动作。
4) 多代理并行运行，人工可随时介入任一窗口。','manual-first（命令驱动复现）','目标：复现 multi-player computer-use。准备 Node18+、Docker、Xpra；启动至少2个独立 agent sandbox 并行执行不同任务，验证每个代理独立窗口/光标且人工可介入。输出冲突与失败日志。','1) 安装 Node.js、Docker、Xpra。
2) 按 Cua 文档完成 onboarding。
3) 运行 cuabot openclaw（或 add-mcp openclaw）。
4) 启动第二个代理沙箱并行验证。
5) 记录窗口流、焦点冲突和人工接管体验。','多代理协作','["multi-agent", "cua"]','["sessions_spawn", "browser", "canvas"]','["https://x.com/francedot/status/2019496082477076496", "https://cua.ai/blog/clawcon-multiplayer", "https://github.com/trycua/cua"]','2026-02-06','依据 Cua 官方博客与对应 X 帖公开信息整理。','bear','published','2026-03-09T04:35:00.000Z','2026-03-09T12:37:35Z'),
('uc_qualify_template','Qualify 的模板化部署','Qualify 模板化部署案例聚焦“即开即用”的 OpenClaw 基础设施拉起，通过预置模板降低部署门槛。','手工部署步骤多且容易遗漏，导致新用户和团队试跑成本高、环境一致性差。','1) 使用现成模板初始化部署。
2) 填充必要环境参数。
3) 启动服务并执行健康检查。
4) 输出标准化部署记录，便于复用与回滚。','install-first（模板部署）','','1) 选择并拉取模板（如 Coolify ready-to-use 模板）。
2) 按文档填写环境参数与密钥。
3) 启动后验证核心链路可用。
4) 记录部署配置用于后续复制。','运维与部署','["deployment", "template"]','["exec", "cron"]','["https://x.com/essamamdani/status/2017235432401224185"]','2026-02-16','依据文档中“Coolify 模板化部署（即开即用）”条目整理；目前公开信息以模板化部署能力描述为主。','bear','published','2026-03-09T04:36:00.000Z','2026-03-09T12:37:51Z'),
('uc_visionclaw','VisionClaw：把 Agent 带进眼镜','VisionClaw 是将 OpenClaw 接入智能眼镜的可穿戴场景案例，强调实时视觉/语音输入与 agent 动作联动。','该案例关注“现实世界输入到可执行 Agent 流程”的链路问题：眼镜侧所见所闻需要被实时理解并触发后续任务。','1) 从眼镜侧采集视觉与语音输入。
2) 进行场景与意图识别。
3) 通过 OpenClaw 路由到查询/记录/提醒等动作。
4) 语音或消息回传结果，并对高风险动作做确认。','manual-first（可穿戴设备接入与实时链路调通）','你是 OpenClaw，复现 VisionClaw（智能眼镜）场景：接收实时视觉与语音输入，完成场景理解与意图识别，触发对应任务并返回结果；关键动作执行前必须二次确认。','1) 准备眼镜侧摄像头/麦克风输入。
2) 打通设备到 OpenClaw 的实时传输。
3) 配置输入到任务动作的映射规则。
4) 做延迟、误触发、确认机制的人测。
5) 用“观察→理解→行动→回传”场景回归验收。','移动与可穿戴','["vision", "wearable"]','["nodes", "tts", "message"]','["https://x.com/RoundtableSpace/status/2020499105257034130", "https://x.com/tmel0211/status/2020750308054556714"]','2026-02-08','依据两条 X 帖公开内容整理，未扩展未证实能力。','bear','published','2026-03-09T04:37:00.000Z','2026-03-09T12:37:35Z')
on conflict (id) do update set
  title=excluded.title, summary=excluded.summary, problem=excluded.problem, workflow=excluded.workflow, repro_mode=excluded.repro_mode, repro_prompt=excluded.repro_prompt, manual_steps=excluded.manual_steps, category=excluded.category, tags=excluded.tags::jsonb, tools=excluded.tools::jsonb, links=excluded.links::jsonb, source_date=excluded.source_date, evidence_note=excluded.evidence_note, submitted_by=excluded.submitted_by, status=excluded.status, updated_at=excluded.updated_at;