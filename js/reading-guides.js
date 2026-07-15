(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.RedWisdomReadingGuides = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    const DEFAULT_LOCALE = 'zh-CN';
    const SUPPORTED_LOCALES = ['zh-CN', 'en'];

    const GUIDES = {
        '实践论': {
            problem: '如何把认识建立在实践上，并用实践检验判断。',
            background: '这篇文章集中说明认识和实践的关系，适合作为进入毛选方法论的第一站。',
            coreIdeas: [
                '认识来源于实践，不来源于空想。',
                '感性认识要上升为理性认识。',
                '理论必须回到实践中接受检验。',
            ],
            scenarios: ['学习新技能', '判断一个想法是否可靠', '把焦虑转成行动'],
            questions: [
                '我现在掌握的是事实，还是想象？',
                '我需要通过哪一次小实践来检验判断？',
            ],
            practice: '选择一个正在拖延的问题，写下一个今天能完成的小实验，并记录结果。',
        },
        '矛盾论': {
            problem: '如何在复杂局面中找出主要矛盾和解决顺序。',
            background: '这篇文章适合用来训练分析冲突、选择、卡点和系统性问题。',
            coreIdeas: [
                '矛盾存在于一切事物的发展过程中。',
                '复杂问题中要抓主要矛盾。',
                '不同性质的矛盾要用不同方法解决。',
            ],
            scenarios: ['职业选择', '团队冲突', '项目推进受阻'],
            questions: [
                '当前最影响全局的矛盾是什么？',
                '哪些矛盾只是表面现象？',
            ],
            practice: '把一个现实问题拆成三条矛盾，并圈出今天最该处理的一条。',
        },
        '论持久战': {
            problem: '如何面对周期长、阻力大、短期看不到结果的问题。',
            background: '这篇文章适合用来理解长期目标的阶段、力量变化和战略耐心。',
            coreIdeas: [
                '长期斗争要看力量对比的变化。',
                '战略上要有信心，战术上要重视困难。',
                '把长期目标拆成阶段性任务。',
            ],
            scenarios: ['长期学习', '创业或项目推进', '走出低谷期'],
            questions: [
                '我现在处在防御、相持还是反攻阶段？',
                '短期要保存和积累什么力量？',
            ],
            practice: '为一个长期目标写下短期、中期、长期三个阶段的任务。',
        },
        '反对本本主义': {
            problem: '如何避免脱离实际，用调查研究替代空想和照搬。',
            background: '这篇文章适合用来纠正只看资料、不看现场、不问真实对象的问题。',
            coreIdeas: [
                '没有调查就没有发言权。',
                '实际情况比书本结论更具体。',
                '调查研究是形成正确判断的前提。',
            ],
            scenarios: ['做决策', '用户研究', '理解一个陌生问题'],
            questions: [
                '我缺少哪三条关键事实？',
                '我应该去问谁、观察什么、验证什么？',
            ],
            practice: '列出一个问题的三条待调查事实，并今天完成其中一条验证。',
        },
        '党委会的工作方法': {
            problem: '如何组织讨论、协调分工、推动集体行动。',
            background: '这篇文章适合用来训练会议、协作、决策和团队推进方法。',
            coreIdeas: [
                '重要问题要摆到桌面上讨论。',
                '学会统筹兼顾，抓紧主要工作。',
                '领导方法要具体、清楚、可执行。',
            ],
            scenarios: ['团队管理', '项目例会', '家庭或小组协作'],
            questions: [
                '哪些问题必须公开讨论？',
                '谁负责什么，什么时候检查？',
            ],
            practice: '把一个团队问题写成议题、负责人、检查时间三项。',
        },
        '为人民服务': {
            problem: '如何把个人选择、责任和长期价值放到更大的服务对象中衡量。',
            background: '这篇短文适合作为价值判断入口，帮助用户区分一时情绪和长期方向。',
            coreIdeas: [
                '判断行动要看它服务谁、解决什么问题。',
                '有缺点不怕批评，关键是能否改正。',
                '个人努力要放到共同目标中检验。',
            ],
            scenarios: ['职业意义感', '处理批评', '长期自我要求'],
            questions: [
                '我现在这件事服务的是谁的真实需要？',
                '别人指出的问题里，哪一条是事实？',
            ],
            practice: '选择一条收到过的批评，区分事实和情绪，今天改一个最小动作。',
        },
        '改造我们的学习': {
            problem: '如何纠正空泛学习，把知识、历史和现实调查结合起来。',
            background: '这篇文章适合用来反省学习方法，避免只背结论、不联系实际。',
            coreIdeas: [
                '学习要联系实际问题。',
                '反对主观主义和空洞口号。',
                '研究历史和现状，是形成判断的基础。',
            ],
            scenarios: ['备考学习', '研究一个行业', '复盘项目经验'],
            questions: [
                '我学的东西对应哪个现实问题？',
                '我有没有只记结论，却没有调查事实？',
            ],
            practice: '把今天要学的一段内容，改写成一个现实问题和三条待核实事实。',
        },
        '关心群众生活，注意工作方法': {
            problem: '如何把目标落实到具体对象、具体困难和具体办法上。',
            background: '这篇文章适合训练从群众痛痒出发设计工作方法，而不是停留在口号。',
            coreIdeas: [
                '任务必须连接群众的实际需要。',
                '提出任务还要解决完成任务的方法。',
                '组织力量要从具体困难入手。',
            ],
            scenarios: ['产品需求', '团队推进', '公共事务和服务设计'],
            questions: [
                '我要帮助的人现在最痛的具体问题是什么？',
                '完成任务缺的是桥、船，还是过河的人？',
            ],
            practice: '选一个目标，写出对象、痛点、缺少条件和今天能补上的一个条件。',
        },
        '中国社会各阶级的分析': {
            problem: '如何识别不同力量的位置、利益和可能行动。',
            background: '这篇文章适合用来训练力量分析，避免把所有人、组织或变量看成一团。',
            coreIdeas: [
                '先分清谁是主要力量、谁是摇摆力量、谁是阻力。',
                '不同群体有不同利益和行动逻辑。',
                '策略要建立在力量结构分析上。',
            ],
            scenarios: ['推进项目', '处理利益冲突', '理解一个复杂组织'],
            questions: [
                '这个问题里有哪些相关力量？',
                '谁支持、谁观望、谁反对，原因分别是什么？',
            ],
            practice: '画出一个现实问题的力量表：支持者、观望者、阻力和可争取对象。',
        },
        '湖南农民运动考察报告': {
            problem: '如何通过现场考察理解新力量，而不是被旧印象支配。',
            background: '这篇文章适合训练现场调查和对新变化的判断。',
            coreIdeas: [
                '判断新事物要到现场看真实运动。',
                '不要被旧秩序和旧评价吓住。',
                '群众行动中包含改变现实的力量。',
            ],
            scenarios: ['观察市场变化', '理解用户行为', '判断新团队或新趋势'],
            questions: [
                '我对这件事的判断来自现场，还是来自二手印象？',
                '新变化背后的真实动力是什么？',
            ],
            practice: '对一个新现象做一次小考察：访谈一人、观察一处、记录三条事实。',
        },
    };

    const ENGLISH_GUIDES = {
        '实践论': {
            problem: 'How to ground understanding in practice and test judgments through action.',
            background: 'This essay explains the relationship between knowledge and practice, making it the best first stop for learning Maoist method.',
            coreIdeas: [
                'Knowledge begins in practice, not speculation.',
                'Concrete experience has to be raised into reasoned understanding.',
                'Theory must return to practice for verification.',
            ],
            scenarios: ['Learning a new skill', 'Testing whether an idea is reliable', 'Turning anxiety into action'],
            questions: [
                'What do I know from facts, and what am I only imagining?',
                'What small practice can test my judgment next?',
            ],
            practice: 'Choose one problem you have been postponing, write one small experiment you can finish today, and record the result.',
        },
        '矛盾论': {
            problem: 'How to identify the principal contradiction and choose the right order of action in a complex situation.',
            background: 'This essay trains readers to analyze conflict, choices, bottlenecks, and systemic problems.',
            coreIdeas: [
                'Contradiction exists in every process of development.',
                'Complex problems require finding the principal contradiction.',
                'Contradictions of different kinds require different methods.',
            ],
            scenarios: ['Career choices', 'Team conflict', 'Blocked projects'],
            questions: [
                'What contradiction most affects the whole situation right now?',
                'Which contradictions are only surface symptoms?',
            ],
            practice: 'Break one real problem into three contradictions, then circle the one that should be handled today.',
        },
        '论持久战': {
            problem: 'How to face long cycles, heavy resistance, and work that does not show results quickly.',
            background: 'This essay helps readers understand stages, changing forces, and strategic patience in long-term goals.',
            coreIdeas: [
                'Long struggles have to be judged by changing balances of strength.',
                'Keep confidence strategically while taking difficulties seriously tactically.',
                'Break long-term goals into stage-based tasks.',
            ],
            scenarios: ['Long-term study', 'Building a project or business', 'Recovering from a low period'],
            questions: [
                'Am I in a defensive, stalemate, or counteroffensive stage?',
                'What strength should I preserve and build in the short term?',
            ],
            practice: 'Write short-term, mid-term, and long-term tasks for one long-term goal.',
        },
        '反对本本主义': {
            problem: 'How to avoid detachment from reality by replacing empty theory and copying with investigation.',
            background: 'This essay corrects the habit of reading materials without looking at the scene or asking real people.',
            coreIdeas: [
                'No investigation, no right to speak.',
                'Actual conditions are more concrete than book conclusions.',
                'Investigation is the premise of sound judgment.',
            ],
            scenarios: ['Decision-making', 'User research', 'Understanding an unfamiliar problem'],
            questions: [
                'Which three key facts am I missing?',
                'Who should I ask, what should I observe, and what should I verify?',
            ],
            practice: 'List three facts that need investigation for one problem, and verify one of them today.',
        },
        '党委会的工作方法': {
            problem: 'How to organize discussion, coordinate responsibility, and move collective action forward.',
            background: 'This essay trains methods for meetings, collaboration, decisions, and team execution.',
            coreIdeas: [
                'Important issues should be brought to the table for discussion.',
                'Coordinate the whole while grasping the main work.',
                'Leadership methods should be concrete, clear, and executable.',
            ],
            scenarios: ['Team management', 'Project meetings', 'Family or group collaboration'],
            questions: [
                'Which issues must be discussed openly?',
                'Who owns what, and when will it be checked?',
            ],
            practice: 'Turn one team issue into an agenda item, an owner, and a review time.',
        },
    };

    const GUIDES_BY_LOCALE = {
        [DEFAULT_LOCALE]: GUIDES,
        en: ENGLISH_GUIDES,
    };

    const THEME_TRACKS = [
        {
            id: 'featured',
            title: '热门文章',
            description: '先读最常被用来训练方法的核心篇目，建立问题分析的主干。',
            articles: ['实践论', '矛盾论', '论持久战', '反对本本主义', '为人民服务'],
            featured: true,
        },
        {
            id: 'practice',
            title: '从认识到行动',
            description: '适合把焦虑、想法和判断转成可验证的小实践。',
            articles: ['实践论', '反对本本主义', '改造我们的学习'],
        },
        {
            id: 'contradiction',
            title: '看清矛盾',
            description: '适合处理冲突、选择、卡点和复杂局面。',
            articles: ['矛盾论', '关于正确处理人民内部矛盾的问题', '中国社会各阶级的分析'],
        },
        {
            id: 'long-term',
            title: '长期斗争',
            description: '适合面对长期目标、阶段推进和低谷期。',
            articles: ['论持久战', '星星之火，可以燎原', '中国革命战争的战略问题'],
        },
        {
            id: 'organization',
            title: '组织协作',
            description: '适合团队推进、会议决策和群众路线。',
            articles: ['党委会的工作方法', '关心群众生活，注意工作方法', '关于领导方法的若干问题'],
        },
        {
            id: 'investigation',
            title: '调查研究',
            description: '适合做决策前补事实，避免只凭资料、经验和情绪判断。',
            articles: ['反对本本主义', '湖南农民运动考察报告', '改造我们的学习'],
        },
        {
            id: 'people',
            title: '服务对象',
            description: '适合处理意义感、责任、批评和真正服务谁的问题。',
            articles: ['为人民服务', '纪念白求恩', '关心群众生活，注意工作方法'],
        },
        {
            id: 'self-correction',
            title: '自我修正',
            description: '适合处理批评、作风、学习习惯和长期自我要求。',
            articles: ['反对自由主义', '整顿党的作风', '改造我们的学习'],
        },
        {
            id: 'expression',
            title: '表达与动员',
            description: '适合训练写作、沟通、宣传和把道理讲给具体的人。',
            articles: ['反对党八股', '在延安文艺座谈会上的讲话', '实践论'],
        },
    ];

    const THEME_TRACK_TRANSLATIONS = {
        en: {
            featured: {
                title: 'Popular Essays',
                description: 'Start with the core essays most often used to train method and build the main frame.',
            },
            practice: {
                title: 'From Understanding to Action',
                description: 'For turning anxiety, ideas, and judgments into small verifiable practices.',
            },
            contradiction: {
                title: 'Find the Contradiction',
                description: 'For handling conflict, choices, bottlenecks, and complex situations.',
            },
            'long-term': {
                title: 'Long-Term Struggle',
                description: 'For long goals, stage-based progress, and difficult periods.',
            },
            organization: {
                title: 'Organization and Collaboration',
                description: 'For team execution, meeting decisions, and the mass line.',
            },
            investigation: {
                title: 'Investigation',
                description: 'For adding facts before decisions instead of relying on materials, habit, or emotion.',
            },
            people: {
                title: 'Who Is Served',
                description: 'For questions of meaning, responsibility, criticism, and who a decision actually serves.',
            },
            'self-correction': {
                title: 'Self-Correction',
                description: 'For criticism, work style, study habits, and long-term self-discipline.',
            },
            expression: {
                title: 'Expression and Mobilization',
                description: 'For writing, communication, persuasion, and making ideas concrete for real people.',
            },
        },
    };

    function normalizeLocale(locale) {
        return SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
    }

    function cloneGuide(guide, locale) {
        return {
            locale,
            problem: guide.problem,
            background: guide.background,
            coreIdeas: [...guide.coreIdeas],
            scenarios: [...guide.scenarios],
            questions: [...guide.questions],
            practice: guide.practice,
        };
    }

    function getReadingGuide(articleTitle, locale = DEFAULT_LOCALE) {
        const normalized = normalizeLocale(locale);
        const localizedGuide = GUIDES_BY_LOCALE[normalized]?.[articleTitle];
        const fallbackGuide = GUIDES[articleTitle];
        const guide = localizedGuide || fallbackGuide;

        if (!guide) return null;

        return cloneGuide(guide, localizedGuide ? normalized : DEFAULT_LOCALE);
    }

    function getThemeTracks(locale = DEFAULT_LOCALE) {
        const normalized = normalizeLocale(locale);
        const translations = THEME_TRACK_TRANSLATIONS[normalized] || {};

        return THEME_TRACKS.map((track) => ({
            ...track,
            locale: translations[track.id] ? normalized : DEFAULT_LOCALE,
            title: translations[track.id]?.title || track.title,
            description: translations[track.id]?.description || track.description,
            articles: [...track.articles],
            featured: Boolean(track.featured),
        }));
    }

    return {
        getReadingGuide,
        getThemeTracks,
    };
});
