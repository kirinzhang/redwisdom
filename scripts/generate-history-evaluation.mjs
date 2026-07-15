import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const categories = {
    investigation: [
        ['管理层说用户很满意，但客服投诉越来越多，我该先相信哪一边？', ['hunan-investigation-1927', 'investigation-meeting-1930', 'editor-audience-1948']],
        ['产品方向争论很久，大家拿的都是二手汇报，怎样查清真实情况？', ['hunan-investigation-1927', 'investigation-outline-participants-1930', 'rural-investigation-leadership-1941']],
        ['我第一次负责一个陌生地区的业务，不知道应该先向哪些人了解情况。', ['stakeholder-map-1925', 'investigation-outline-participants-1930', 'learn-from-below-1949']],
        ['团队已经定了方案，但支持它的事实很少，更多只是经验判断。', ['practice-facts-before-theory-1937', 'hunan-investigation-1927', 'investigation-meeting-1930']],
        ['创始人觉得自己最懂客户，一线同事却说需求已经变了。', ['learn-from-below-1949', 'hunan-investigation-1927', 'editor-audience-1948']],
        ['我要做用户访谈，怎样避免只问支持自己观点的人？', ['investigation-outline-participants-1930', 'stakeholder-map-1925', 'practice-facts-before-theory-1937']],
        ['一个项目出了问题，当前只有传言，没有可确认的原因。', ['investigation-meeting-1930', 'practice-facts-before-theory-1937', 'hunan-investigation-1927']],
        ['总部制定的新流程在门店执行不动，是否应该先去现场看看？', ['rural-investigation-leadership-1941', 'learn-from-below-1949', 'hunan-investigation-1927']],
        ['我写的内容专业但没人看，可能是我根本不了解读者。', ['editor-audience-1948', 'stakeholder-map-1925', 'hunan-investigation-1927']],
        ['面对完全不同的利益相关者，如何把他们的诉求调查清楚？', ['stakeholder-map-1925', 'investigation-outline-participants-1930', 'hunan-investigation-1927']],
        ['数据支持两个相反结论，我该如何回到实践判断哪一个成立？', ['practice-facts-before-theory-1937', 'practice-recognition-cycle-1937', 'investigation-meeting-1930']],
    ],
    priority: [
        ['公司同时推进八个项目，每个都说自己最重要，人手已经摊薄了。', ['piano-priorities-1949', 'concentrate-one-by-one-1946', 'focus-front-1950']],
        ['我每天忙很多事，却不知道哪件事真正影响全局。', ['principal-contradiction-focus-1937', 'focus-front-1950', 'piano-priorities-1949']],
        ['预算只能支持一个增长方向，应该怎样选择主任务？', ['concentrate-one-by-one-1946', 'focus-front-1950', 'principal-contradiction-focus-1937']],
        ['团队只抓一个指标后出现了副作用，怎样兼顾其他重要工作？', ['piano-priorities-1949', 'strategic-tactical-balance-1948', 'principal-contradiction-focus-1937']],
        ['两个紧急问题同时发生，怎么判断哪一个是主要矛盾？', ['principal-contradiction-focus-1937', 'focus-front-1950', 'strategic-tactical-balance-1948']],
        ['资源不足时，是平均分给各项目还是集中做成一个？', ['concentrate-one-by-one-1946', 'focus-front-1950', 'border-economy-1942']],
        ['核心产品还不稳定，老板又想做三个新市场。', ['focus-front-1950', 'concentrate-one-by-one-1946', 'piano-priorities-1949']],
        ['计划排得很满，却忽略了客户采购季节和发布窗口。', ['seasonal-plan-1948', 'piano-priorities-1949', 'strategic-tactical-balance-1948']],
        ['我们只顾销售增长，现金流和交付能力快跟不上了。', ['economic-work-1933', 'piano-priorities-1949', 'border-economy-1942']],
        ['长期战略很清楚，但眼前每天的行动总是偏离重点。', ['strategic-tactical-balance-1948', 'focus-front-1950', 'grasp-tight-1949']],
        ['我总把容易做的小事先做，真正困难的关键问题不断拖延。', ['principal-contradiction-focus-1937', 'focus-front-1950', 'grasp-tight-1949']],
    ],
    'failure-recovery': [
        ['项目失败了，团队现在只想追究是谁的责任，没人总结判断错在哪里。', ['zunyi-correction-1935', 'learning-history-unity-1944', 'three-month-review-1946']],
        ['投入很多后发现方向可能错了，我舍不得承认沉没成本。', ['strategic-retreat-yanan-1947', 'zunyi-correction-1935', 'practice-recognition-cycle-1937']],
        ['上一次试点没有效果，下一轮应该怎样从失败中修正？', ['practice-recognition-cycle-1937', 'three-month-review-1946', 'leadership-pilot-1943']],
        ['团队反复翻旧账，历史问题让现在的合作无法继续。', ['learning-history-unity-1944', 'seventh-congress-self-criticism-1945', 'zunyi-correction-1935']],
        ['我犯了一个明显错误，但担心承认以后失去大家信任。', ['service-feedback-1944', 'zunyi-correction-1935', 'rectification-learning-1942']],
        ['战略执行三个月后情况已经变化，要不要重新检查原计划？', ['three-month-review-1946', 'practice-recognition-cycle-1937', 'strategic-retreat-yanan-1947']],
        ['重大分歧已经有了结论，怎样让大家重新团结做事？', ['seventh-congress-self-criticism-1945', 'learning-history-unity-1944', 'zunyi-correction-1935']],
        ['局部市场守不住，继续投入可能拖垮整个公司。', ['strategic-retreat-yanan-1947', 'zunyi-correction-1935', 'focus-front-1950']],
        ['过去的经验曾经有效，现在照做却连续失败。', ['practice-recognition-cycle-1937', 'rectification-learning-1942', 'contradiction-particularity-1937']],
        ['用户指出我们产品有严重缺点，团队第一反应是辩解。', ['service-feedback-1944', 'practice-recognition-cycle-1937', 'hunan-investigation-1927']],
        ['失败复盘变成了公开羞辱，大家以后都不敢说真话。', ['learning-history-unity-1944', 'seventh-congress-self-criticism-1945', 'rectification-learning-1942']],
    ],
    'long-term-pressure': [
        ['创业两年仍然很弱小，我越来越焦虑，看不到希望。', ['spark-strategy-1930', 'red-power-conditions-1928', 'protracted-war-stages-1938']],
        ['长期学习没有明显进步，我怀疑坚持还有没有意义。', ['yugong-persistence-1945', 'practice-recognition-cycle-1937', 'protracted-war-stages-1938']],
        ['强大的竞争者进入市场，团队觉得我们没有任何机会。', ['paper-tiger-confidence-1946', 'spark-strategy-1930', 'northeast-base-1945']],
        ['目标很远，短期又没有反馈，怎样划分阶段保持节奏？', ['protracted-war-stages-1938', 'yugong-persistence-1945', 'spark-strategy-1930']],
        ['大家把暂时困难当成最终失败，士气正在下降。', ['spark-strategy-1930', 'paper-tiger-confidence-1946', 'protracted-war-stages-1938']],
        ['我们进入最热门的市场处处受挫，是否应该换一个立足点？', ['northeast-base-1945', 'red-power-conditions-1928', 'strategic-retreat-yanan-1947']],
        ['我想保持信心，又怕自己忽视眼前的具体风险。', ['paper-tiger-confidence-1946', 'strategic-tactical-balance-1948', 'protracted-war-stages-1938']],
        ['长期项目靠热情启动，但一个月后大家都坚持不下去。', ['yugong-persistence-1945', 'grasp-tight-1949', 'protracted-war-stages-1938']],
        ['现有条件很差，但局部已经出现支持我们继续做的因素。', ['red-power-conditions-1928', 'spark-strategy-1930', 'northeast-base-1945']],
        ['外部压力持续很久，我分不清现在处于哪个阶段。', ['protracted-war-stages-1938', 'spark-strategy-1930', 'strategic-tactical-balance-1948']],
        ['困难太大时，怎样避免盲目乐观和彻底悲观两个极端？', ['paper-tiger-confidence-1946', 'protracted-war-stages-1938', 'red-power-conditions-1928']],
    ],
    'team-conflict': [
        ['团队意见不合，互相指责，讨论已经变成人身攻击。', ['rectification-learning-1942', 'put-problems-on-table-1949', 'seventh-congress-self-criticism-1945']],
        ['大家开会不说，会后却不断抱怨和传播不满。', ['anti-liberalism-accountability-1937', 'put-problems-on-table-1949', 'committee-working-method-1949']],
        ['领导层只愿意和赞同自己的人合作，反对意见被排除。', ['unite-different-opinions-1949', 'democratic-centralism-1929', 'committee-working-method-1949']],
        ['一次重大争论后，成员虽然留下来但彼此不再信任。', ['seventh-congress-self-criticism-1945', 'learning-history-unity-1944', 'rectification-learning-1942']],
        ['同事的错误影响了项目，我怎样批评问题又不破坏团结？', ['rectification-learning-1942', 'anti-liberalism-accountability-1937', 'service-feedback-1944']],
        ['跨部门矛盾长期不进入正式议程，只在私下争论。', ['put-problems-on-table-1949', 'committee-working-method-1949', 'exchange-information-1949']],
        ['团队想统一行动，但成员担心决定前没有充分表达意见。', ['democratic-centralism-1929', 'committee-working-method-1949', 'unite-different-opinions-1949']],
        ['复盘会议总在追责个人，没有分析环境和制度原因。', ['learning-history-unity-1944', 'rectification-learning-1942', 'zunyi-correction-1935']],
        ['管理者把不同意见看成不忠诚，团队已经不敢反馈。', ['unite-different-opinions-1949', 'service-feedback-1944', 'democratic-centralism-1929']],
        ['熟人关系让大家不愿指出明显问题，原则性反馈越来越少。', ['anti-liberalism-accountability-1937', 'service-feedback-1944', 'put-problems-on-table-1949']],
        ['争议已经形成决定，但少数人仍然用消极方式拒绝执行。', ['democratic-centralism-1929', 'unite-different-opinions-1949', 'committee-working-method-1949']],
    ],
    'organization-governance': [
        ['公司扩张后信息孤岛严重，管理层不了解一线。', ['reporting-system-1948', 'exchange-information-1949', 'learn-from-below-1949']],
        ['创始人所有重大事项都自己拍板，其他高管只是执行。', ['healthy-committee-system-1948', 'committee-working-method-1949', 'division-coordination-1949']],
        ['领导班子每周开会但没有议题，也形成不了明确决定。', ['meeting-notice-1949', 'committee-working-method-1949', 'healthy-committee-system-1948']],
        ['团队从十人变成一百人，各地基本规则互相冲突。', ['unified-discipline-1947', 'reporting-system-1948', 'healthy-committee-system-1948']],
        ['多人共同负责一个项目，最后变成没有人真正负责。', ['division-coordination-1949', 'committee-working-method-1949', 'grasp-tight-1949']],
        ['总部需要统一方向，又不想逐项审批地方团队的动作。', ['self-reliance-production-1945', 'reporting-system-1948', 'differentiated-land-policy-1948']],
        ['重大决策没有书面材料和反方意见，出问题后也无法追溯。', ['healthy-committee-system-1948', 'committee-working-method-1949', 'reporting-system-1948']],
        ['组织里职责不清、纪律不一，新人不知道什么是底线。', ['unified-discipline-1947', 'gutian-organization-correction-1929', 'healthy-committee-system-1948']],
        ['负责人应该协调集体，但现在要么越权，要么什么也不管。', ['division-coordination-1949', 'committee-working-method-1949', 'healthy-committee-system-1948']],
        ['各部门掌握不同版本的数据，决策会上始终无法形成共同事实。', ['exchange-information-1949', 'reporting-system-1948', 'put-problems-on-table-1949']],
        ['组织目标很清楚，但决定之后没有负责人和检查节点。', ['grasp-tight-1949', 'division-coordination-1949', 'committee-working-method-1949']],
    ],
    'needs-communication': [
        ['用户不愿意使用新功能，团队却只想加强宣传。', ['changgang-caixi-service-1934', 'material-benefits-base-1945', 'masses-recognition-cycle-1943']],
        ['员工听到的都是愿景口号，却看不到工作条件的实际改善。', ['material-benefits-base-1945', 'changgang-caixi-service-1934', 'service-feedback-1944']],
        ['客户说我们的方案听不懂，专业团队认为是客户水平不够。', ['editor-audience-1948', 'youth-characteristics-1953', 'learn-from-below-1949']],
        ['政策制定者知道目标，一线执行者却不知道为什么做。', ['editor-audience-1948', 'masses-recognition-cycle-1943', 'exchange-information-1949']],
        ['服务对象不断投诉，但反馈从未进入改进流程。', ['service-feedback-1944', 'changgang-caixi-service-1934', 'masses-recognition-cycle-1943']],
        ['同一个培训模板用于所有人，年轻成员参与度很低。', ['youth-characteristics-1953', 'differentiated-land-policy-1948', 'editor-audience-1948']],
        ['我们想动员社区参与项目，却没有先问他们真正需要什么。', ['changgang-caixi-service-1934', 'stakeholder-map-1925', 'material-benefits-base-1945']],
        ['管理者不懂一线工作，又不好意思向基层同事请教。', ['learn-from-below-1949', 'rural-investigation-leadership-1941', 'editor-audience-1948']],
        ['内容团队只表达自己想讲的，没有研究受众的真实疑问。', ['editor-audience-1948', 'stakeholder-map-1925', 'youth-characteristics-1953']],
        ['产品承诺很宏大，但用户无法看到任何可感知的价值。', ['material-benefits-base-1945', 'changgang-caixi-service-1934', 'masses-recognition-cycle-1943']],
        ['需求访谈做完就结束了，方案上线后没有回访用户。', ['masses-recognition-cycle-1943', 'changgang-caixi-service-1934', 'service-feedback-1944']],
    ],
    'resource-constraint': [
        ['创业初期现金流紧张，人手也不够，应该怎样形成供给能力？', ['border-economy-1942', 'economic-work-1933', 'self-reliance-production-1945']],
        ['团队每个人资源都不足，但能力互补，能否组织互助？', ['organize-mutual-aid-1943', 'border-economy-1942', 'self-reliance-production-1945']],
        ['核心业务增长很快，后勤和基础设施却快撑不住了。', ['economic-work-1933', 'border-economy-1942', 'piano-priorities-1949']],
        ['我们进入大市场成本太高，是否先找能稳定立足的小区域？', ['northeast-base-1945', 'border-economy-1942', 'red-power-conditions-1928']],
        ['预算不足时怎样判断哪些能力自建、哪些适合外部合作？', ['public-private-economy-1934', 'self-reliance-production-1945', 'united-front-independence-1938']],
        ['团队不懂经营，现金危机中又必须快速学会经济工作。', ['learn-economic-work-1945', 'economic-work-1933', 'border-economy-1942']],
        ['资源平均分给所有项目，结果每一个都无法完成。', ['concentrate-one-by-one-1946', 'focus-front-1950', 'border-economy-1942']],
        ['外部供应不稳定，我们需要建立一部分自主能力。', ['self-reliance-production-1945', 'public-private-economy-1934', 'border-economy-1942']],
        ['公益项目只有口号，没有给参与者解决任何现实困难。', ['material-benefits-base-1945', 'changgang-caixi-service-1934', 'economic-work-1933']],
        ['多个地方团队条件不同，统一采购和本地执行如何平衡？', ['self-reliance-production-1945', 'public-private-economy-1934', 'differentiated-land-policy-1948']],
        ['我们只盯核心目标，却没有盘点人员、现金、工具和时间约束。', ['economic-work-1933', 'border-economy-1942', 'focus-front-1950']],
    ],
    'cooperation-boundaries': [
        ['最大的客户也是合作伙伴，我们太依赖对方，决策权和退出边界不清。', ['united-front-independence-1938', 'unite-struggle-policy-1940', 'public-private-economy-1934']],
        ['合作项目有共同目标，但双方在关键原则上存在分歧。', ['unite-struggle-policy-1940', 'united-front-independence-1938', 'unite-different-opinions-1949']],
        ['为了维持伙伴关系，我们不断让步，已经失去自己的核心能力。', ['united-front-independence-1938', 'unite-struggle-policy-1940', 'strategic-retreat-yanan-1947']],
        ['进入陌生市场需要联盟，怎样先识别不同参与者的利益？', ['stakeholder-map-1925', 'united-front-independence-1938', 'public-private-economy-1934']],
        ['团队只愿意与意见一致的人合作，形成了同温层。', ['unite-different-opinions-1949', 'unite-struggle-policy-1940', 'democratic-centralism-1929']],
        ['一个人做不完的社区项目，怎样通过互助形成持续合作？', ['organize-mutual-aid-1943', 'stakeholder-map-1925', 'material-benefits-base-1945']],
        ['业务能力是全部自建还是采购，团队争论不休。', ['public-private-economy-1934', 'self-reliance-production-1945', 'united-front-independence-1938']],
        ['我们需要引入专家，又担心专家与实际业务完全脱节。', ['intellectuals-integration-1939', 'editor-audience-1948', 'learn-from-below-1949']],
        ['合作方多次破坏约定，但共同项目仍有继续的价值。', ['unite-struggle-policy-1940', 'united-front-independence-1938', 'put-problems-on-table-1949']],
        ['跨机构协作中，信息、决策权限和退出条件都没有写清楚。', ['united-front-independence-1938', 'unite-struggle-policy-1940', 'healthy-committee-system-1948']],
        ['和过去有分歧的同事继续合作时，怎样保留异议又共同执行？', ['unite-different-opinions-1949', 'democratic-centralism-1929', 'seventh-congress-self-criticism-1945']],
    ],
    'execution-experiment': [
        ['方案在会议上得到赞同，执行一个月却没有任何进展。', ['grasp-tight-1949', 'masses-recognition-cycle-1943', 'leadership-pilot-1943']],
        ['新制度风险很大，我想先选一个小范围试点再推广。', ['leadership-pilot-1943', 'differentiated-land-policy-1948', 'masses-recognition-cycle-1943']],
        ['几个地区成熟度不同，总部却要求同一天执行同一套方案。', ['differentiated-land-policy-1948', 'youth-characteristics-1953', 'self-reliance-production-1945']],
        ['用户反馈收集很多，但产品上线后从不回访验证。', ['masses-recognition-cycle-1943', 'practice-recognition-cycle-1937', 'service-feedback-1944']],
        ['会议决定没有负责人、交付物和检查日期。', ['grasp-tight-1949', 'meeting-notice-1949', 'division-coordination-1949']],
        ['产品发布时间只按内部计划，没有考虑客户的真实时间窗口。', ['seasonal-plan-1948', 'differentiated-land-policy-1948', 'masses-recognition-cycle-1943']],
        ['同一个沟通方式对资深员工有效，对新人完全无效。', ['youth-characteristics-1953', 'differentiated-land-policy-1948', 'contradiction-particularity-1937']],
        ['总部要统一标准，又希望地方团队能按条件选择做法。', ['self-reliance-production-1945', 'differentiated-land-policy-1948', 'leadership-pilot-1943']],
        ['服务改进必须让用户看到实际变化，不能只发布口号。', ['material-benefits-base-1945', 'changgang-caixi-service-1934', 'masses-recognition-cycle-1943']],
        ['工作质量总不稳定，怎样把持续改进变成日常动作？', ['technical-craft-bethune-1939', 'grasp-tight-1949', 'practice-recognition-cycle-1937']],
        ['临时开会太多，参会者没材料也不知道需要决定什么。', ['meeting-notice-1949', 'committee-working-method-1949', 'grasp-tight-1949']],
    ],
    'learning-growth': [
        ['我读了很多理论，遇到真实问题时还是不会使用。', ['practice-facts-before-theory-1937', 'practice-recognition-cycle-1937', 'rectification-learning-1942']],
        ['过去经验很丰富，为什么到了新业务反而不断判断错误？', ['rectification-learning-1942', 'contradiction-particularity-1937', 'practice-recognition-cycle-1937']],
        ['团队需要总结历史错误，但不想让学习变成无限追责。', ['learning-history-unity-1944', 'seventh-congress-self-criticism-1945', 'zunyi-correction-1935']],
        ['我接手完全陌生的经营工作，应该怎样边做边学？', ['learn-economic-work-1945', 'practice-recognition-cycle-1937', 'learn-from-below-1949']],
        ['团队缺专业人才，也担心新专家不了解现场。', ['intellectuals-integration-1939', 'learn-from-below-1949', 'editor-audience-1948']],
        ['内容编辑只懂理论，不懂读者面对的实际问题。', ['editor-audience-1948', 'rural-investigation-leadership-1941', 'practice-facts-before-theory-1937']],
        ['技能练习多年停滞，我缺少明确质量标准和错误记录。', ['technical-craft-bethune-1939', 'practice-recognition-cycle-1937', 'grasp-tight-1949']],
        ['每次复盘都总结很多，但下一次行动没有验证这些认识。', ['practice-recognition-cycle-1937', 'masses-recognition-cycle-1943', 'three-month-review-1946']],
        ['团队把文件当答案，遇到具体情况不会独立分析。', ['rectification-learning-1942', 'practice-facts-before-theory-1937', 'contradiction-particularity-1937']],
        ['管理者不愿承认自己不懂，错过了向一线学习的机会。', ['learn-from-below-1949', 'rural-investigation-leadership-1941', 'editor-audience-1948']],
        ['培训对所有年龄和经验的人使用同一方法，效果很差。', ['youth-characteristics-1953', 'differentiated-land-policy-1948', 'contradiction-particularity-1937']],
    ],
    'risk-decision': [
        ['信息不完整又必须做重大决策，怎样先控制判断风险？', ['investigation-meeting-1930', 'practice-facts-before-theory-1937', 'strategic-tactical-balance-1948']],
        ['市场看起来很大，但我们还不具备在那里稳定立足的条件。', ['red-power-conditions-1928', 'northeast-base-1945', 'contradiction-particularity-1937']],
        ['长期趋势有利，眼前具体执行风险却很高。', ['paper-tiger-confidence-1946', 'strategic-tactical-balance-1948', 'protracted-war-stages-1938']],
        ['局部业务亏损严重，是否暂时退出以保存核心能力？', ['strategic-retreat-yanan-1947', 'focus-front-1950', 'zunyi-correction-1935']],
        ['同一个策略在不同地区效果相反，不能继续一刀切。', ['contradiction-particularity-1937', 'differentiated-land-policy-1948', 'seasonal-plan-1948']],
        ['竞争者很强，我们既不能被吓住，也不能在细节上轻敌。', ['paper-tiger-confidence-1946', 'spark-strategy-1930', 'strategic-tactical-balance-1948']],
        ['当前危机需要行动，但我不知道应该在哪个阶段做什么。', ['protracted-war-stages-1938', 'strategic-tactical-balance-1948', 'three-month-review-1946']],
        ['合作伙伴很重要，但我们没有保留退出和自主决策能力。', ['united-front-independence-1938', 'unite-struggle-policy-1940', 'public-private-economy-1934']],
        ['发布时机与客户周期冲突，错过窗口可能造成重大损失。', ['seasonal-plan-1948', 'strategic-tactical-balance-1948', 'contradiction-particularity-1937']],
        ['供应能力是自建、合作还是采购，需要按风险和控制权选择。', ['public-private-economy-1934', 'self-reliance-production-1945', 'united-front-independence-1938']],
        ['团队只看长期信心，不愿讨论每个具体环节的失败概率。', ['paper-tiger-confidence-1946', 'strategic-tactical-balance-1948', 'investigation-meeting-1930']],
    ],
};

const negativeQueries = [
    '帮我查明天北京的天气。', '把这句话翻译成英文。', '这个验证码为什么收不到？',
    '帮我查询快递单号到哪里了。', '用计算器算一下 128 乘 37。', '给春天写一首诗。',
    '帮我生成一个随机密码。', '推荐一道西红柿菜谱。', '查询明天的航班号。',
    '现在这只股票价格是多少？', '上海周末天气适合出门吗？', '把邮件翻译成日语。',
    '六位验证码应该填在哪里？', '查一下这个快递单号的物流。', '计算器算 18% 的折扣。',
    '写一首诗作为生日祝福。', '生成密码时要包含特殊字符。', '这道菜谱需要放多少盐？',
];

const positiveItems = Object.entries(categories).flatMap(([expectedProblemType, rows]) => rows.map(([query, acceptableCaseIds], index) => ({
    id: `${expectedProblemType}-${String(index + 1).padStart(2, '0')}`,
    query,
    expectedProblemType,
    acceptableCaseIds,
    allowAnalogy: true,
})));
const negativeItems = negativeQueries.map((query, index) => ({
    id: `no-analogy-${String(index + 1).padStart(2, '0')}`,
    query,
    expectedProblemType: null,
    acceptableCaseIds: [],
    allowAnalogy: false,
}));
const items = [...positiveItems, ...negativeItems];

if (positiveItems.length !== 132 || negativeItems.length !== 18 || items.length !== 150) {
    throw new Error(`Evaluation set must contain 132 positive and 18 negative items; received ${positiveItems.length} and ${negativeItems.length}.`);
}

const output = {
    version: 1,
    updatedAt: '2026-07-14',
    definition: {
        top3Hit: 'At least one of the first three retrieved case IDs is in acceptableCaseIds.',
        citationAccuracy: 'Every retrieved citation must point to an indexed primary excerpt and an approved authoritative-history URL.',
        forcedAnalogy: 'A history case is returned for an item with allowAnalogy=false.',
    },
    items,
};

const outputPath = path.join(rootDir, 'data/evaluation/history-retrieval-150.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`Generated ${items.length} evaluation items at ${outputPath}.\n`);
