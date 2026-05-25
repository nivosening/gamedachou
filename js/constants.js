// constants.js
// 遊戲常數定義 — 區域、出身、據點、職業、姓名片段等

// 宗族之書：家族經營遊戲 - 單一 JS 檔（V3 修正版 - 修正新增身份、領養 UI、新增年齡輸入、新增人物編輯與離婚）
// 世界設定：星曆 387 年為起點

const INITIAL_YEAR = 387;

const DEFAULT_REGIONS = [
  { id: "north", name: "漠北邊境", desc: "多山多關隘，邊疆軍鎮與遊牧勢力並立之地。" },
  { id: "central", name: "天府王畿", desc: "朝廷所在，商旅雲集，權力與文化中心。" },
  { id: "south", name: "南域水鄉", desc: "水網縱橫，魚米之鄉，多江湖幫會盤踞。" },
  { id: "east", name: "東海沿岸", desc: "臨海諸城與商港，外族與海商往來頻繁。" },
  { id: "west", name: "西川雲嶺", desc: "高山峽谷與古道關城，易守難攻。" },
  { id: "desert", name: "塞外沙漠", desc: "風沙孤城，絲路商隊與異族部落的領域。" },
  { id: "islands", name: "南海群島", desc: "散落海上的諸島，有海盜、有隱世門派。" }
];

const DEFAULT_ORIGINS = ["皇室貴族" ,"名門望族", "商賈世家", "武林門派", "落魄寒門", "平民百姓"];

// v6+:家族門第(用於議親計分時判斷門當戶對)
// 由高至低,index 越小代表門第越高
const DEFAULT_STANDINGS = ["上品世家", "中品仕宦", "尋常人家", "寒微之家"];

// 據點與區域為一對一對應（每個據點只屬於一個區域）
const DEFAULT_TERRITORIES = [
  { name: "京城王都", regionId: "central" },
  { name: "江南府城", regionId: "south" },
  { name: "關中城鎮", regionId: "central" },
  { name: "邊關要塞", regionId: "north" },
  { name: "東海港市", regionId: "east" },
  { name: "西川古鎮", regionId: "west" },
  { name: "水鄉集市", regionId: "south" }
];

const DEFAULT_OCCS = ["家主", "皇族", "軍師", "商人", "平民", "官員", "學生", "無業"];
const DEFAULT_RES = ["皇宮", "祖宅", "別莊", "工舍", "行腳在外"];

// [FIX 1] 增加 DEFAULT_ROLES
const DEFAULT_ROLES = ["家主（主君）","內眷（內郎）","嫡支子女", "庶出子女", "旁系宗親", "長老", "附庸"];

const STORAGE_KEY = "clanGame_star_v3";

const GIVEN_NAME_PARTS = [
  "清","海","季","秀","世","伊","雙","珊","玖","辰","嵐",
  "瑜","衡","蕙","岑","柏","霖","雪","庭","思","柳","琪",
  "琦","舞","綺","雲","澈","澄"
];

const SPOUSE_TYPES = ["平妻", "妾", "繼室", "入贅", "訂婚"];

// ============================================================
// 名位卷宗(大周職位系統)
// ============================================================
const POSITION_CATEGORIES = ["後宮","皇族","朝官","前朝女官","後宮女官","王府","侯府","軍職","學院"];

const POSITION_STATUSES = ["在任","空缺","待議","待定","已定未冊","已冊封","未入冊","疑案中","暫停職權","外嫁","已故","被廢","失勢"];

// 預設職銜骨架(由 dazhouonly 整合而來,只存職位定義,人物從 state.persons 派任)
const DEFAULT_POSITIONS = [
  {
    "category": "後宮",
    "system": "後宮",
    "position": "皇后",
    "rank": "中宮正位",
    "quota": 1,
    "note": "母儀天下，掌宮權、禮權、教權、議政權與監察權。"
  },
  {
    "category": "後宮",
    "system": "後宮",
    "position": "皇貴妃",
    "rank": "副后級",
    "quota": 1,
    "note": "可空缺。"
  },
  {
    "category": "後宮",
    "system": "後宮",
    "position": "貴妃",
    "rank": "高階妃嬪",
    "quota": 2,
    "note": "定員二席。"
  },
  {
    "category": "後宮",
    "system": "後宮",
    "position": "妃",
    "rank": "一宮主位",
    "quota": 4,
    "note": "一宮主位，可撫育皇子女。"
  },
  {
    "category": "後宮",
    "system": "後宮",
    "position": "貴嬪／嬪",
    "rank": "中位嬪御",
    "quota": 6,
    "note": "貴嬪介於妃位以下、嬪位以上。"
  },
  {
    "category": "後宮",
    "system": "後宮",
    "position": "貴人",
    "rank": "低階主位",
    "quota": 0,
    "note": "有封號、有固定份例，人數不定。"
  },
  {
    "category": "後宮",
    "system": "後宮",
    "position": "才人／美人",
    "rank": "低階后妃",
    "quota": 0,
    "note": "低階后妃，人數不定。"
  },
  {
    "category": "後宮",
    "system": "後宮",
    "position": "常在",
    "rank": "低階后妃",
    "quota": 0,
    "note": "低階后妃，人數不定。"
  },
  {
    "category": "後宮",
    "system": "後宮",
    "position": "答應",
    "rank": "低階后妃",
    "quota": 0,
    "note": "低階后妃，人數不定。"
  },
  {
    "category": "後宮",
    "system": "後宮",
    "position": "官女子／御侍",
    "rank": "準后妃／候召",
    "quota": 0,
    "note": "準后妃，候召；需經正式冊封才成為后妃。"
  },
  {
    "category": "皇族",
    "system": "皇帝直系",
    "position": "皇帝",
    "rank": "至尊",
    "quota": 1,
    "note": "當朝皇帝。"
  },
  {
    "category": "皇族",
    "system": "皇帝直系",
    "position": "皇太后",
    "rank": "太后",
    "quota": 1,
    "note": "皇太后。"
  },
  {
    "category": "皇族",
    "system": "東宮",
    "position": "太子",
    "rank": "儲君",
    "quota": 1,
    "note": "儲君。"
  },
  {
    "category": "皇族",
    "system": "東宮",
    "position": "太子妃",
    "rank": "儲妃",
    "quota": 1,
    "note": "太子正妃。"
  },
  {
    "category": "皇族",
    "system": "皇帝子女",
    "position": "親王／皇子",
    "rank": "皇子封王",
    "quota": 0,
    "note": "皇帝皇子，含親王與未封王皇子。"
  },
  {
    "category": "皇族",
    "system": "皇帝子女",
    "position": "公主／長公主",
    "rank": "皇女封號",
    "quota": 0,
    "note": "皇帝皇女，含公主、長公主。"
  },
  {
    "category": "皇族",
    "system": "親王系",
    "position": "親王妃",
    "rank": "王府正妃",
    "quota": 0,
    "note": "親王正妃。"
  },
  {
    "category": "皇族",
    "system": "親王系",
    "position": "世子",
    "rank": "親王嫡嗣",
    "quota": 0,
    "note": "親王府世子。"
  },
  {
    "category": "皇族",
    "system": "親王系",
    "position": "郡王",
    "rank": "親王子嗣封號",
    "quota": 0,
    "note": "親王子可封郡王。"
  },
  {
    "category": "皇族",
    "system": "親王系",
    "position": "郡主／縣主",
    "rank": "親王女封號",
    "quota": 0,
    "note": "親王之女可封郡主、縣主。"
  },
  {
    "category": "皇族",
    "system": "郡王系",
    "position": "郡王妃",
    "rank": "郡王正妃",
    "quota": 0,
    "note": "郡王正妃。"
  },
  {
    "category": "皇族",
    "system": "郡王系",
    "position": "郡王世子／宗室公子",
    "rank": "郡王子嗣封號",
    "quota": 0,
    "note": "郡王子嗣名分。"
  },
  {
    "category": "皇族",
    "system": "郡王系",
    "position": "縣主／宗姬",
    "rank": "郡王女封號",
    "quota": 0,
    "note": "郡王之女或宗室女。"
  },
  {
    "category": "皇族",
    "system": "遠支宗室",
    "position": "國公／將軍／宗室子",
    "rank": "遠支宗室男性封號",
    "quota": 0,
    "note": "遠支宗室、旁支男性可用。"
  },
  {
    "category": "皇族",
    "system": "遠支宗室",
    "position": "郡君／縣君／宗女",
    "rank": "遠支宗室女性封號",
    "quota": 0,
    "note": "遠支宗室女眷可用。"
  },
  {
    "category": "朝官",
    "system": "三公",
    "position": "太師／太傅／太保",
    "rank": "正一品",
    "quota": 3,
    "note": "多為榮銜或元老重臣。"
  },
  {
    "category": "朝官",
    "system": "三孤",
    "position": "少師／少傅／少保",
    "rank": "從一品",
    "quota": 3,
    "note": "次於三公。"
  },
  {
    "category": "朝官",
    "system": "內閣",
    "position": "內閣首輔",
    "rank": "正一品",
    "quota": 1,
    "note": "票擬、議政，朝堂中樞最高實權位之一。"
  },
  {
    "category": "朝官",
    "system": "內閣",
    "position": "內閣次輔",
    "rank": "正一品／從一品",
    "quota": 1,
    "note": "首輔副手。"
  },
  {
    "category": "朝官",
    "system": "內閣",
    "position": "殿閣大學士",
    "rank": "正一品至從一品",
    "quota": 0,
    "note": "內閣大臣，替皇帝票擬、議政。"
  },
  {
    "category": "朝官",
    "system": "內閣",
    "position": "協辦大學士",
    "rank": "從一品",
    "quota": 2,
    "note": "內閣高位副職。"
  },
  {
    "category": "朝官",
    "system": "軍機處",
    "position": "領班軍機大臣",
    "rank": "正一品／從一品",
    "quota": 1,
    "note": "掌軍國機密、密旨。"
  },
  {
    "category": "朝官",
    "system": "軍機處",
    "position": "軍機大臣",
    "rank": "從一品至正二品",
    "quota": 4,
    "note": "軍機處核心。"
  },
  {
    "category": "朝官",
    "system": "軍機處",
    "position": "軍機章京",
    "rank": "中低品文官",
    "quota": 0,
    "note": "掌軍機文書。"
  },
  {
    "category": "朝官",
    "system": "吏部",
    "position": "尚書",
    "rank": "正二品",
    "quota": 1,
    "note": "掌官員任免、考核、誥命；前朝女官任官亦須登冊。"
  },
  {
    "category": "朝官",
    "system": "戶部",
    "position": "尚書",
    "rank": "正二品",
    "quota": 1,
    "note": "掌財政、稅賦、戶籍、漕運。"
  },
  {
    "category": "朝官",
    "system": "禮部",
    "position": "尚書",
    "rank": "正二品",
    "quota": 1,
    "note": "掌禮制、祭祀、冊封、科舉、外交。"
  },
  {
    "category": "朝官",
    "system": "兵部",
    "position": "尚書",
    "rank": "正二品",
    "quota": 1,
    "note": "掌軍政、武官任免、軍械、調兵。"
  },
  {
    "category": "朝官",
    "system": "刑部",
    "position": "尚書",
    "rank": "正二品",
    "quota": 1,
    "note": "掌刑獄、審判、律法。"
  },
  {
    "category": "朝官",
    "system": "工部",
    "position": "尚書",
    "rank": "正二品",
    "quota": 1,
    "note": "掌工程、營造、水利、宮殿。"
  },
  {
    "category": "朝官",
    "system": "六部",
    "position": "左右侍郎",
    "rank": "從二品",
    "quota": 12,
    "note": "六部各左、右侍郎。"
  },
  {
    "category": "朝官",
    "system": "六部",
    "position": "郎中",
    "rank": "正五品",
    "quota": 0,
    "note": "六部中層官員。"
  },
  {
    "category": "朝官",
    "system": "六部",
    "position": "員外郎",
    "rank": "從五品",
    "quota": 0,
    "note": "六部中層副職。"
  },
  {
    "category": "朝官",
    "system": "六部",
    "position": "主事",
    "rank": "正六品",
    "quota": 0,
    "note": "六部基層主辦官。"
  },
  {
    "category": "朝官",
    "system": "都察院",
    "position": "左都御史",
    "rank": "正二品",
    "quota": 1,
    "note": "統領都察院，可彈劾百官。"
  },
  {
    "category": "朝官",
    "system": "都察院",
    "position": "御史",
    "rank": "正五品以下",
    "quota": 0,
    "note": "品級雖低，但可彈劾百官。"
  },
  {
    "category": "朝官",
    "system": "大理寺",
    "position": "大理寺卿",
    "rank": "正三品",
    "quota": 1,
    "note": "重大案件覆審，三法司會審必有。"
  },
  {
    "category": "朝官",
    "system": "大理寺",
    "position": "大理寺少卿",
    "rank": "副職",
    "quota": 2,
    "note": "大理寺副職。"
  },
  {
    "category": "朝官",
    "system": "通政司",
    "position": "通政使",
    "rank": "正三品",
    "quota": 1,
    "note": "奏章交通與朝廷文書線。"
  },
  {
    "category": "朝官",
    "system": "地方官",
    "position": "總督",
    "rank": "從一品",
    "quota": 0,
    "note": "封疆大吏。"
  },
  {
    "category": "朝官",
    "system": "地方官",
    "position": "巡撫",
    "rank": "從二品",
    "quota": 0,
    "note": "地方高級官員。"
  },
  {
    "category": "朝官",
    "system": "地方官",
    "position": "布政使",
    "rank": "從二品",
    "quota": 0,
    "note": "地方財政與行政。"
  },
  {
    "category": "朝官",
    "system": "地方官",
    "position": "按察使",
    "rank": "正三品",
    "quota": 0,
    "note": "地方司法監察。"
  },
  {
    "category": "朝官",
    "system": "地方官",
    "position": "知縣",
    "rank": "正七品",
    "quota": 0,
    "note": "縣級主官。"
  },
  {
    "category": "朝官",
    "system": "翰林院",
    "position": "修撰／編修",
    "rank": "正六品至正七品",
    "quota": 0,
    "note": "掌詔書、修史、講學。"
  },
  {
    "category": "朝官",
    "system": "國子監",
    "position": "祭酒／司業",
    "rank": "正四品至從四品",
    "quota": 2,
    "note": "最高官學主官與副職。"
  },
  {
    "category": "朝官",
    "system": "內務府",
    "position": "內務府總管",
    "rank": "內廷官",
    "quota": 1,
    "note": "宮廷財物採買，與內廷辦案銜接。"
  },
  {
    "category": "朝官",
    "system": "太醫院",
    "position": "院使／院判",
    "rank": "醫官",
    "quota": 2,
    "note": "御藥房、安胎香、暖夢香案可牽涉。"
  },
  {
    "category": "朝官",
    "system": "內廷協辦機構",
    "position": "敬事房",
    "rank": "內廷機構",
    "quota": 0,
    "note": "侍寢紀錄。"
  },
  {
    "category": "朝官",
    "system": "內廷協辦機構",
    "position": "慎刑司",
    "rank": "內廷機構",
    "quota": 0,
    "note": "宮人案件。"
  },
  {
    "category": "朝官",
    "system": "內廷協辦機構",
    "position": "御膳房",
    "rank": "內廷機構",
    "quota": 0,
    "note": "宮廷膳食。"
  },
  {
    "category": "朝官",
    "system": "內廷協辦機構",
    "position": "御藥房",
    "rank": "內廷機構",
    "quota": 0,
    "note": "宮廷藥事。"
  },
  {
    "category": "朝官",
    "system": "內廷協辦機構",
    "position": "造辦處",
    "rank": "內廷機構",
    "quota": 0,
    "note": "宮廷器物造辦。"
  },
  {
    "category": "朝官",
    "system": "內廷協辦機構",
    "position": "掖庭局",
    "rank": "內廷機構",
    "quota": 0,
    "note": "宮人與罪籍宮人管理。"
  },
  {
    "category": "朝官",
    "system": "宗人府",
    "position": "宗人令",
    "rank": "宗室官",
    "quota": 1,
    "note": "掌皇族宗籍、玉牒、宗室婚配與親王府名分審核。"
  },
  {
    "category": "朝官",
    "system": "宗正寺",
    "position": "宗正卿",
    "rank": "宗室司法官",
    "quota": 1,
    "note": "查宗室舊譜、移記、入嗣、回嫁兄弟等宗室舊案。"
  },
  {
    "category": "前朝女官",
    "system": "最高女臣",
    "position": "女太傅",
    "rank": "正二品至從二品",
    "quota": 1,
    "note": "最高等女臣，極少設置。"
  },
  {
    "category": "前朝女官",
    "system": "最高女臣",
    "position": "女大學士",
    "rank": "正二品至從二品",
    "quota": 1,
    "note": "最高等女臣，極少設置。"
  },
  {
    "category": "前朝女官",
    "system": "最高女臣",
    "position": "女御史大夫",
    "rank": "正二品至從二品",
    "quota": 1,
    "note": "最高等女臣，極少設置。"
  },
  {
    "category": "前朝女官",
    "system": "女史臺",
    "position": "女史令",
    "rank": "正三品",
    "quota": 1,
    "note": "女官文書與制度中樞主官。"
  },
  {
    "category": "前朝女官",
    "system": "女史臺",
    "position": "女史丞",
    "rank": "從三品",
    "quota": 2,
    "note": "女史臺副主官。"
  },
  {
    "category": "前朝女官",
    "system": "女史臺",
    "position": "女史",
    "rank": "六品至七品",
    "quota": 0,
    "note": "女史臺執行官。"
  },
  {
    "category": "前朝女官",
    "system": "女史臺",
    "position": "見習女史／女書吏",
    "rank": "八九品",
    "quota": 0,
    "note": "初任或學官。"
  },
  {
    "category": "前朝女官",
    "system": "女察院",
    "position": "女察院使",
    "rank": "正三品",
    "quota": 1,
    "note": "女官監察與女眷陳情主官。"
  },
  {
    "category": "前朝女官",
    "system": "女察院",
    "position": "女察副使",
    "rank": "從三品",
    "quota": 1,
    "note": "女察院副主官。"
  },
  {
    "category": "前朝女官",
    "system": "女察院",
    "position": "女御史",
    "rank": "從四品",
    "quota": 0,
    "note": "可上奏、巡查、辦案。"
  },
  {
    "category": "前朝女官",
    "system": "女察院",
    "position": "女察史",
    "rank": "六品至七品",
    "quota": 0,
    "note": "女察院執行官。"
  },
  {
    "category": "前朝女官",
    "system": "女學士院",
    "position": "女學士令",
    "rank": "正三品",
    "quota": 1,
    "note": "女翰林與制度研究主官。"
  },
  {
    "category": "前朝女官",
    "system": "女學士院",
    "position": "女學士丞",
    "rank": "從三品",
    "quota": 1,
    "note": "女學士院副主官。"
  },
  {
    "category": "前朝女官",
    "system": "女學士院",
    "position": "女典章",
    "rank": "從四品",
    "quota": 0,
    "note": "掌典章、修史、制度文本。"
  },
  {
    "category": "前朝女官",
    "system": "女學士院",
    "position": "女禮官",
    "rank": "從四品",
    "quota": 0,
    "note": "掌禮制、冊命、女眷儀制。"
  },
  {
    "category": "前朝女官",
    "system": "女醫署",
    "position": "女醫令",
    "rank": "正四品",
    "quota": 1,
    "note": "女醫、婦科、產科、驗傷主官。"
  },
  {
    "category": "前朝女官",
    "system": "女醫署",
    "position": "女醫丞",
    "rank": "正五品",
    "quota": 2,
    "note": "女醫署中層官員。"
  },
  {
    "category": "前朝女官",
    "system": "女醫署",
    "position": "女醫官",
    "rank": "六品至七品",
    "quota": 0,
    "note": "女醫署執行官。"
  },
  {
    "category": "前朝女官",
    "system": "女醫署",
    "position": "女醫生",
    "rank": "八九品",
    "quota": 0,
    "note": "初任或學官。"
  },
  {
    "category": "前朝女官",
    "system": "宗室女官司",
    "position": "宗室女官使",
    "rank": "正四品",
    "quota": 1,
    "note": "宗室女眷婚配、名分、意願審查、宗籍旁錄。"
  },
  {
    "category": "前朝女官",
    "system": "宗室女官司",
    "position": "宗室掌籍女官",
    "rank": "正五品",
    "quota": 1,
    "note": "掌宗室女眷名冊與旁錄。"
  },
  {
    "category": "前朝女官",
    "system": "宗室女官司",
    "position": "宗室掌婚女官",
    "rank": "正五品",
    "quota": 1,
    "note": "掌宗室婚配案卷。"
  },
  {
    "category": "前朝女官",
    "system": "女武官署",
    "position": "女武官統領",
    "rank": "正四品",
    "quota": 1,
    "note": "女護衛與女武官體系主官。"
  },
  {
    "category": "前朝女官",
    "system": "女武官署",
    "position": "女武教習",
    "rank": "六品至七品",
    "quota": 0,
    "note": "女武學與護衛訓練。"
  },
  {
    "category": "前朝女官",
    "system": "外藩女禮司",
    "position": "外藩女禮使",
    "rank": "正四品",
    "quota": 1,
    "note": "外族貴女與和親禮制。"
  },
  {
    "category": "前朝女官",
    "system": "外藩女禮司",
    "position": "外藩女禮官",
    "rank": "從四品至正五品",
    "quota": 0,
    "note": "外藩貴女學禮、和親女官。"
  },
  {
    "category": "前朝女官",
    "system": "六部協辦",
    "position": "女郎中",
    "rank": "正五品",
    "quota": 0,
    "note": "可入六部協辦。"
  },
  {
    "category": "前朝女官",
    "system": "六部協辦",
    "position": "女主事",
    "rank": "正五品",
    "quota": 0,
    "note": "可入六部協辦。"
  },
  {
    "category": "前朝女官",
    "system": "女官學／女史院",
    "position": "女教習",
    "rank": "六品至七品",
    "quota": 0,
    "note": "培養女史、女察史、女學士、女醫、女武官、外藩禮制人才。"
  },
  {
    "category": "後宮女官",
    "system": "尚宮局",
    "position": "尚宮",
    "rank": "最高",
    "quota": 1,
    "note": "後宮女官總領，協助皇后統攝六宮女官。"
  },
  {
    "category": "後宮女官",
    "system": "尚儀局",
    "position": "尚儀",
    "rank": "高階",
    "quota": 1,
    "note": "掌禮儀、冊封、請安、宮宴、命婦朝賀。"
  },
  {
    "category": "後宮女官",
    "system": "尚服局",
    "position": "尚服",
    "rank": "高階",
    "quota": 1,
    "note": "掌衣料、冠服、后妃服制、賞賜衣物。"
  },
  {
    "category": "後宮女官",
    "system": "尚食局",
    "position": "尚食",
    "rank": "高階",
    "quota": 1,
    "note": "掌膳食、宴席、茶水、藥膳。"
  },
  {
    "category": "後宮女官",
    "system": "尚寢局",
    "position": "尚寢",
    "rank": "高階",
    "quota": 1,
    "note": "掌寢殿、侍寢流程、夜間值宿。"
  },
  {
    "category": "後宮女官",
    "system": "尚功局",
    "position": "尚功",
    "rank": "高階",
    "quota": 1,
    "note": "掌女紅、織造、器物、宮女技藝。"
  },
  {
    "category": "後宮女官",
    "system": "尚藥局",
    "position": "尚藥",
    "rank": "高階",
    "quota": 1,
    "note": "掌后妃湯藥、香藥、安胎藥、煎藥送藥。"
  },
  {
    "category": "後宮女官",
    "system": "尚儀局",
    "position": "典儀",
    "rank": "中階",
    "quota": 0,
    "note": "尚儀局副官或分司主管。"
  },
  {
    "category": "後宮女官",
    "system": "尚服局",
    "position": "典服",
    "rank": "中階",
    "quota": 0,
    "note": "尚服局副官或分司主管。"
  },
  {
    "category": "後宮女官",
    "system": "尚食局",
    "position": "典膳",
    "rank": "中階",
    "quota": 0,
    "note": "尚食局副官或分司主管。"
  },
  {
    "category": "後宮女官",
    "system": "尚寢局",
    "position": "典寢",
    "rank": "中階",
    "quota": 0,
    "note": "尚寢局副官或分司主管。"
  },
  {
    "category": "後宮女官",
    "system": "尚功局",
    "position": "典功",
    "rank": "中階",
    "quota": 0,
    "note": "尚功局副官或分司主管。"
  },
  {
    "category": "後宮女官",
    "system": "尚藥局",
    "position": "典藥",
    "rank": "中階",
    "quota": 0,
    "note": "尚藥局副官或分司主管。"
  },
  {
    "category": "後宮女官",
    "system": "尚儀局",
    "position": "掌儀",
    "rank": "執行層",
    "quota": 0,
    "note": "日常執行與人員調度。"
  },
  {
    "category": "後宮女官",
    "system": "尚服局",
    "position": "掌服",
    "rank": "執行層",
    "quota": 0,
    "note": "日常執行與人員調度。"
  },
  {
    "category": "後宮女官",
    "system": "尚食局",
    "position": "掌膳",
    "rank": "執行層",
    "quota": 0,
    "note": "日常執行與人員調度。"
  },
  {
    "category": "後宮女官",
    "system": "尚寢局",
    "position": "掌寢",
    "rank": "執行層",
    "quota": 0,
    "note": "日常執行與人員調度。"
  },
  {
    "category": "後宮女官",
    "system": "尚藥局",
    "position": "掌藥",
    "rank": "執行層",
    "quota": 0,
    "note": "日常執行與人員調度。"
  },
  {
    "category": "後宮女官",
    "system": "內廷文書",
    "position": "女史／司記",
    "rank": "基層",
    "quota": 0,
    "note": "文書、記錄、名冊。"
  },
  {
    "category": "後宮女官",
    "system": "內廷庫房",
    "position": "司帳／司燈／司衣",
    "rank": "基層",
    "quota": 0,
    "note": "庫房、燈火、衣物等細務。"
  },
  {
    "category": "後宮女官",
    "system": "宮學",
    "position": "宮學女官／實習女史",
    "rank": "見習",
    "quota": 0,
    "note": "尚未正式掌職或等待補缺。"
  },
  {
    "category": "後宮女官",
    "system": "宮正司",
    "position": "宮正",
    "rank": "內廷紀律",
    "quota": 1,
    "note": "掌宮人紀律、訓誡、內廷初審。"
  },
  {
    "category": "後宮女官",
    "system": "司籍司",
    "position": "司籍",
    "rank": "名冊調動",
    "quota": 1,
    "note": "掌宮女、後宮女官、內侍名冊與調動。"
  },
  {
    "category": "後宮女官",
    "system": "司珍司",
    "position": "司珍",
    "rank": "珠寶賞賜",
    "quota": 1,
    "note": "掌珠寶、首飾、賞賜、貢品分發。"
  },
  {
    "category": "後宮女官",
    "system": "司苑司",
    "position": "司苑",
    "rank": "御苑花木",
    "quota": 1,
    "note": "掌御花園、宮中花木、賞花宴佈置。"
  },
  {
    "category": "王府",
    "system": "王府通用",
    "position": "王妃",
    "rank": "正妃",
    "quota": 1,
    "note": "王府正妻，子女為嫡出。"
  },
  {
    "category": "王府",
    "system": "王府通用",
    "position": "側妃",
    "rank": "側妃",
    "quota": 2,
    "note": "側室高位，子女為側出，高於普通庶出。"
  },
  {
    "category": "王府",
    "system": "王府通用",
    "position": "庶妃",
    "rank": "低等側室",
    "quota": 0,
    "note": "王府低等側室。"
  },
  {
    "category": "王府",
    "system": "王府通用",
    "position": "侍妾",
    "rank": "低等側室",
    "quota": 0,
    "note": "王府侍妾，子女為低等庶出。"
  },
  {
    "category": "王府",
    "system": "王府通用",
    "position": "通房／外室",
    "rank": "未正式／府外名分",
    "quota": 0,
    "note": "子女需認祖後入冊。"
  },
  {
    "category": "王府",
    "system": "王府通用",
    "position": "王府子嗣",
    "rank": "王府子女",
    "quota": 0,
    "note": "王府子女名分登錄。"
  },
  {
    "category": "侯府",
    "system": "侯府通用",
    "position": "家主",
    "rank": "侯府主君",
    "quota": 1,
    "note": "侯府主君。"
  },
  {
    "category": "侯府",
    "system": "侯府通用",
    "position": "侯夫人／正妻",
    "rank": "正妻",
    "quota": 1,
    "note": "侯府正妻，子女為嫡出。"
  },
  {
    "category": "侯府",
    "system": "侯府通用",
    "position": "平妻",
    "rank": "次等妻",
    "quota": 0,
    "note": "高於庶出，低於正妻嫡出。"
  },
  {
    "category": "侯府",
    "system": "侯府通用",
    "position": "貴妾／側夫人",
    "rank": "高等側室",
    "quota": 0,
    "note": "高於一般妾室。"
  },
  {
    "category": "侯府",
    "system": "侯府通用",
    "position": "妾室",
    "rank": "妾室",
    "quota": 0,
    "note": "一般庶出之母。"
  },
  {
    "category": "侯府",
    "system": "侯府通用",
    "position": "侍妾",
    "rank": "低等側室",
    "quota": 0,
    "note": "侍奉型名分。"
  },
  {
    "category": "侯府",
    "system": "侯府通用",
    "position": "通房／外室",
    "rank": "未正式／府外名分",
    "quota": 0,
    "note": "子女認祖後為庶出。"
  },
  {
    "category": "侯府",
    "system": "侯府通用",
    "position": "侯府子嗣",
    "rank": "侯府子女",
    "quota": 0,
    "note": "侯府子女名分登錄。"
  },
  {
    "category": "軍職",
    "system": "武將品級",
    "position": "大將軍／上柱國",
    "rank": "正一品",
    "quota": 2,
    "note": "國家級統帥。"
  },
  {
    "category": "軍職",
    "system": "武將品級",
    "position": "都督／提督／鎮北將軍",
    "rank": "從一品",
    "quota": 0,
    "note": "掌一方軍務。"
  },
  {
    "category": "軍職",
    "system": "武將品級",
    "position": "總兵",
    "rank": "正二品",
    "quota": 0,
    "note": "鎮守一鎮。"
  },
  {
    "category": "軍職",
    "system": "禁軍",
    "position": "禁軍統領",
    "rank": "正二品",
    "quota": 1,
    "note": "掌禁軍。"
  },
  {
    "category": "軍職",
    "system": "武將品級",
    "position": "副將",
    "rank": "從二品",
    "quota": 0,
    "note": "副統帥。"
  },
  {
    "category": "軍職",
    "system": "武將品級",
    "position": "參將",
    "rank": "正三品",
    "quota": 0,
    "note": "分守一路。"
  },
  {
    "category": "軍職",
    "system": "武將品級",
    "position": "游擊將軍",
    "rank": "從三品",
    "quota": 0,
    "note": "機動作戰。"
  },
  {
    "category": "軍職",
    "system": "武將品級",
    "position": "都司",
    "rank": "正四品",
    "quota": 0,
    "note": "掌營衛。"
  },
  {
    "category": "軍職",
    "system": "武將品級",
    "position": "守備",
    "rank": "正五品",
    "quota": 0,
    "note": "守城、守關。"
  },
  {
    "category": "軍職",
    "system": "武將品級",
    "position": "千總",
    "rank": "正六品",
    "quota": 0,
    "note": "管數百兵。"
  },
  {
    "category": "軍職",
    "system": "武將品級",
    "position": "把總",
    "rank": "正七品",
    "quota": 0,
    "note": "基層武官。"
  },
  {
    "category": "軍職",
    "system": "禁軍",
    "position": "領侍衛內大臣",
    "rank": "正一品",
    "quota": 1,
    "note": "掌皇帝近身侍衛。"
  },
  {
    "category": "軍職",
    "system": "禁軍",
    "position": "羽林衛",
    "rank": "禁軍",
    "quota": 0,
    "note": "京中禁軍。"
  },
  {
    "category": "軍職",
    "system": "禁軍",
    "position": "金吾衛",
    "rank": "禁軍",
    "quota": 0,
    "note": "京中禁軍。"
  },
  {
    "category": "軍職",
    "system": "禁軍",
    "position": "龍武衛",
    "rank": "禁軍",
    "quota": 0,
    "note": "京中禁軍。"
  },
  {
    "category": "軍職",
    "system": "邊軍",
    "position": "北境軍主將",
    "rank": "邊軍",
    "quota": 0,
    "note": "對應烏桓、左賢王舊支。"
  },
  {
    "category": "軍職",
    "system": "邊軍",
    "position": "西涼軍主將",
    "rank": "邊軍",
    "quota": 0,
    "note": "西涼邊鎮。"
  },
  {
    "category": "軍職",
    "system": "邊軍",
    "position": "東海軍主將",
    "rank": "邊軍",
    "quota": 0,
    "note": "東海邊鎮。"
  },
  {
    "category": "軍職",
    "system": "邊軍",
    "position": "南疆軍主將",
    "rank": "邊軍",
    "quota": 0,
    "note": "南疆邊鎮。"
  },
  {
    "category": "軍職",
    "system": "女武官",
    "position": "女將軍",
    "rank": "從二品至正三品",
    "quota": 0,
    "note": "女武官高階。"
  },
  {
    "category": "軍職",
    "system": "女武官",
    "position": "女都尉",
    "rank": "正四品",
    "quota": 0,
    "note": "女武官。"
  },
  {
    "category": "軍職",
    "system": "女武官",
    "position": "女校尉",
    "rank": "正六品",
    "quota": 0,
    "note": "女武官。"
  },
  {
    "category": "軍職",
    "system": "女武官",
    "position": "女騎尉",
    "rank": "女武官",
    "quota": 0,
    "note": "女武官。"
  },
  {
    "category": "軍職",
    "system": "女武官",
    "position": "女護衛長",
    "rank": "正六品以上",
    "quota": 0,
    "note": "公主、王妃與和親女眷護衛。"
  },
  {
    "category": "軍職",
    "system": "女武官",
    "position": "女武教習",
    "rank": "教習",
    "quota": 0,
    "note": "女武學教習。"
  },
  {
    "category": "軍職",
    "system": "女武官",
    "position": "女巡檢／女營兵",
    "rank": "基層",
    "quota": 0,
    "note": "女武官基層。"
  },
  {
    "category": "學院",
    "system": "國子監",
    "position": "祭酒／司業",
    "rank": "最高官學",
    "quota": 2,
    "note": "最高官學主官與副職。"
  },
  {
    "category": "學院",
    "system": "皇家書院",
    "position": "山長",
    "rank": "書院主官",
    "quota": 1,
    "note": "皇子、皇女、宗室、高門子弟教育核心。"
  },
  {
    "category": "學院",
    "system": "皇家書院女院",
    "position": "女院教習",
    "rank": "教習",
    "quota": 0,
    "note": "女子分院教習。"
  },
  {
    "category": "學院",
    "system": "女史院",
    "position": "禮制課教習",
    "rank": "教習",
    "quota": 0,
    "note": "女官、禮制與宗室婚配課程。"
  },
  {
    "category": "學院",
    "system": "女學士院",
    "position": "女學課程教習",
    "rank": "教習",
    "quota": 0,
    "note": "女學、修史、典章與制度研究。"
  },
  {
    "category": "學院",
    "system": "女醫學",
    "position": "女醫教習",
    "rank": "教習",
    "quota": 0,
    "note": "女醫、婦科、產科、驗傷訓練。"
  },
  {
    "category": "學院",
    "system": "女武學",
    "position": "女武教習",
    "rank": "教習",
    "quota": 0,
    "note": "女護衛、女武官訓練。"
  },
  {
    "category": "學院",
    "system": "外藩禮制學",
    "position": "外藩禮制教習",
    "rank": "教習",
    "quota": 0,
    "note": "外藩貴女、和親禮制教育。"
  },
  {
    "category": "學院",
    "system": "慕容家學／青梧書院",
    "position": "男學教習",
    "rank": "家學教習",
    "quota": 0,
    "note": "慕容家男學。"
  },
  {
    "category": "學院",
    "system": "慕容家學／秋水女塾",
    "position": "女學教習",
    "rank": "家學教習",
    "quota": 0,
    "note": "慕容家女子教育。"
  },
  {
    "category": "學院",
    "system": "慕容家學／立雪齋",
    "position": "禮法教習",
    "rank": "家學教習",
    "quota": 0,
    "note": "禮法、女官預備。"
  },
  {
    "category": "學院",
    "system": "慕容家學／衡蘭堂",
    "position": "帳冊財務教習",
    "rank": "家學教習",
    "quota": 0,
    "note": "帳冊財務。"
  },
  {
    "category": "學院",
    "system": "慕容家學／藏鋒院",
    "position": "武學教習",
    "rank": "家學教習",
    "quota": 0,
    "note": "武學、護衛。"
  }
];
