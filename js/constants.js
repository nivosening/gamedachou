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
const POSITION_CATEGORIES = ["後宮","皇族","朝官","女官","王府","侯府","軍職","學院"];

const POSITION_STATUSES = ["在任","空缺","待議","待定","已定未冊","已冊封","未入冊","疑案中","暫停職權","外嫁","已故","被廢"];

// 預設職銜骨架(由 dazhouonly 整合而來,只存職位定義,人物從 state.persons 派任)
const DEFAULT_POSITIONS = [
  {category:"後宮", system:"後宮", position:"皇后", rank:"中宮正位", quota:1, note:""},
  {category:"後宮", system:"後宮", position:"皇貴妃", rank:"副后級", quota:1, note:""},
  {category:"後宮", system:"後宮", position:"貴妃", rank:"高階妃嬪", quota:2, note:""},
  {category:"後宮", system:"後宮", position:"妃", rank:"一宮主位", quota:4, note:""},
  {category:"後宮", system:"後宮", position:"貴嬪／嬪", rank:"中位嬪御", quota:6, note:""},
  {category:"後宮", system:"後宮", position:"貴人", rank:"低階主位", quota:0, note:""},
  {category:"後宮", system:"後宮", position:"才人／美人", rank:"低階后妃", quota:0, note:""},
  {category:"後宮", system:"後宮", position:"常在", rank:"低階后妃", quota:0, note:""},
  {category:"後宮", system:"後宮", position:"答應", rank:"低階后妃", quota:0, note:""},
  {category:"後宮", system:"後宮", position:"官女子／御侍", rank:"準后妃／候召", quota:0, note:""},
  {category:"皇族", system:"皇帝直系", position:"皇帝", rank:"至尊", quota:1, note:""},
  {category:"皇族", system:"皇帝直系", position:"皇太后", rank:"太后", quota:1, note:""},
  {category:"皇族", system:"東宮", position:"太子", rank:"儲君", quota:1, note:""},
  {category:"皇族", system:"東宮", position:"太子妃", rank:"儲妃", quota:1, note:""},
  {category:"皇族", system:"親王／皇子", position:"親王／皇子", rank:"皇子封王", quota:0, note:""},
  {category:"皇族", system:"公主", position:"公主／長公主", rank:"皇女封號", quota:0, note:""},
  {category:"皇族", system:"親王系", position:"親王妃", rank:"王府正妃", quota:0, note:""},
  {category:"皇族", system:"親王系", position:"世子／郡王", rank:"親王子嗣封號", quota:0, note:""},
  {category:"皇族", system:"親王系", position:"郡主／縣主", rank:"親王女封號", quota:0, note:""},
  {category:"皇族", system:"遠支宗室", position:"國公／將軍／宗室子", rank:"遠支宗室男性封號", quota:0, note:""},
  {category:"皇族", system:"遠支宗室", position:"郡君／縣君／宗女", rank:"遠支宗室女性封號", quota:0, note:""},
  {category:"朝官", system:"三公", position:"太師／太傅／太保", rank:"正一品", quota:3, note:""},
  {category:"朝官", system:"三孤", position:"少師／少傅／少保", rank:"從一品", quota:3, note:""},
  {category:"朝官", system:"內閣", position:"內閣首輔", rank:"正一品", quota:1, note:""},
  {category:"朝官", system:"內閣", position:"內閣次輔", rank:"正一品／從一品", quota:1, note:""},
  {category:"朝官", system:"內閣", position:"協辦大學士", rank:"從一品", quota:2, note:""},
  {category:"朝官", system:"軍機處", position:"領班軍機大臣", rank:"正一品／從一品", quota:1, note:""},
  {category:"朝官", system:"軍機處", position:"軍機大臣", rank:"從一品至正二品", quota:4, note:""},
  {category:"朝官", system:"軍機處", position:"軍機章京", rank:"中低品文官", quota:0, note:""},
  {category:"朝官", system:"吏部", position:"尚書", rank:"正二品", quota:1, note:""},
  {category:"朝官", system:"戶部", position:"尚書", rank:"正二品", quota:1, note:""},
  {category:"朝官", system:"禮部", position:"尚書", rank:"正二品", quota:1, note:""},
  {category:"朝官", system:"兵部", position:"尚書", rank:"正二品", quota:1, note:""},
  {category:"朝官", system:"刑部", position:"尚書", rank:"正二品", quota:1, note:""},
  {category:"朝官", system:"工部", position:"尚書", rank:"正二品", quota:1, note:""},
  {category:"朝官", system:"六部", position:"左右侍郎", rank:"從二品", quota:12, note:""},
  {category:"朝官", system:"六部", position:"郎中", rank:"正五品", quota:0, note:""},
  {category:"朝官", system:"六部", position:"員外郎", rank:"從五品", quota:0, note:""},
  {category:"朝官", system:"六部", position:"主事", rank:"正六品", quota:0, note:""},
  {category:"朝官", system:"都察院", position:"左都御史", rank:"正二品", quota:1, note:""},
  {category:"朝官", system:"都察院", position:"御史", rank:"正五品以下", quota:0, note:""},
  {category:"朝官", system:"大理寺", position:"大理寺卿", rank:"正三品", quota:1, note:""},
  {category:"朝官", system:"通政司", position:"通政使", rank:"正三品", quota:1, note:""},
  {category:"朝官", system:"翰林院", position:"修撰／編修", rank:"正六品至正七品", quota:0, note:""},
  {category:"朝官", system:"國子監", position:"祭酒／司業", rank:"正四品至從四品", quota:2, note:""},
  {category:"朝官", system:"內務府", position:"內務府總管", rank:"內廷官", quota:1, note:""},
  {category:"朝官", system:"太醫院", position:"院使／院判", rank:"醫官", quota:2, note:""},
  {category:"女官", system:"女史臺", position:"女史令", rank:"正三品", quota:1, note:""},
  {category:"女官", system:"女史臺", position:"左右女史丞", rank:"從三品", quota:2, note:""},
  {category:"女官", system:"女史臺", position:"司籍／司制／司記／司禮女史", rank:"正五品", quota:4, note:""},
  {category:"女官", system:"女史臺", position:"典籍／記注女史", rank:"正七品", quota:0, note:""},
  {category:"女官", system:"女史臺", position:"掌案女史", rank:"正八品", quota:0, note:""},
  {category:"女官", system:"司議院", position:"司議女官", rank:"女臣議政", quota:0, note:""},
  {category:"女官", system:"女察院", position:"女察使", rank:"正四品", quota:1, note:""},
  {category:"女官", system:"女察院", position:"女察御史", rank:"女官監察", quota:0, note:""},
  {category:"女官", system:"女學士院", position:"女學士", rank:"正四品／正五品", quota:4, note:""},
  {category:"女官", system:"宗室女官司", position:"宗室女官令", rank:"正四品", quota:1, note:""},
  {category:"女官", system:"宗室女官司", position:"宗室掌籍／掌婚女官", rank:"宗室女官", quota:2, note:""},
  {category:"女官", system:"後宮女官", position:"尚宮", rank:"正五品", quota:1, note:""},
  {category:"女官", system:"後宮女官", position:"宮中女史", rank:"正七品", quota:0, note:""},
  {category:"王府", system:"寧王府", position:"王妃", rank:"正妃", quota:1, note:""},
  {category:"王府", system:"寧王府", position:"側妃", rank:"側妃", quota:2, note:""},
  {category:"王府", system:"寧王府", position:"侍妾", rank:"低等側室", quota:0, note:""},
  {category:"王府", system:"寧王府", position:"外居內眷／外室", rank:"府外名分", quota:0, note:""},
  {category:"王府", system:"寧王府", position:"子嗣", rank:"王府子女", quota:0, note:""},
  {category:"王府", system:"趙王府", position:"王妃", rank:"正妃", quota:1, note:""},
  {category:"王府", system:"趙王府", position:"側妃／庶妃", rank:"側室", quota:0, note:""},
  {category:"王府", system:"韓王府", position:"王妃", rank:"正妃", quota:1, note:""},
  {category:"王府", system:"韓王府", position:"側妃", rank:"側妃", quota:2, note:""},
  {category:"王府", system:"魏王府", position:"王妃", rank:"正妃", quota:1, note:""},
  {category:"王府", system:"王府通用", position:"庶妃", rank:"低等側室", quota:0, note:""},
  {category:"王府", system:"王府通用", position:"通房", rank:"未正式名分", quota:0, note:""},
  {category:"侯府", system:"慕容侯府", position:"家主", rank:"侯府主君", quota:1, note:""},
  {category:"侯府", system:"慕容侯府", position:"侯夫人（正妻）", rank:"正妻", quota:1, note:""},
  {category:"侯府", system:"慕容侯府", position:"平妻", rank:"次正妻", quota:3, note:""},
  {category:"侯府", system:"慕容侯府", position:"貴妾／側夫人", rank:"高等側室", quota:0, note:""},
  {category:"侯府", system:"慕容侯府", position:"妾室", rank:"妾室", quota:0, note:""},
  {category:"侯府", system:"慕容侯府", position:"侍妾", rank:"低等側室", quota:0, note:""},
  {category:"侯府", system:"慕容侯府", position:"通房／外室", rank:"未正式／府外名分", quota:0, note:""},
  {category:"軍職", system:"武將品級", position:"大將軍／上柱國", rank:"正一品", quota:2, note:""},
  {category:"軍職", system:"武將品級", position:"都督／提督／鎮北將軍", rank:"從一品", quota:0, note:""},
  {category:"軍職", system:"禁軍", position:"領侍衛內大臣", rank:"正一品", quota:1, note:""},
  {category:"軍職", system:"禁軍", position:"禁軍統領", rank:"正二品", quota:1, note:""},
  {category:"軍職", system:"北境軍", position:"鎮北將軍", rank:"從一品", quota:1, note:""},
  {category:"軍職", system:"武將品級", position:"總兵", rank:"正二品", quota:0, note:""},
  {category:"軍職", system:"武將品級", position:"副將", rank:"從二品", quota:0, note:""},
  {category:"軍職", system:"武將品級", position:"參將", rank:"正三品", quota:0, note:""},
  {category:"軍職", system:"武將品級", position:"游擊將軍", rank:"從三品", quota:0, note:""},
  {category:"軍職", system:"武將品級", position:"都司", rank:"正四品", quota:0, note:""},
  {category:"軍職", system:"武將品級", position:"守備", rank:"正五品", quota:0, note:""},
  {category:"軍職", system:"武將品級", position:"千總／把總", rank:"正六品至正七品", quota:0, note:""},
  {category:"軍職", system:"女武官", position:"女將軍／女都尉／女校尉", rank:"從二品至正六品", quota:0, note:""},
  {category:"軍職", system:"女武官", position:"女護衛長", rank:"正六品以上", quota:0, note:""},
  {category:"學院", system:"皇家書院／崇文書院", position:"山長", rank:"書院主官", quota:1, note:""},
  {category:"學院", system:"皇家書院／明政堂", position:"政務課教習", rank:"教習", quota:0, note:""},
  {category:"學院", system:"皇家書院／修禮堂", position:"禮制課教習", rank:"教習", quota:0, note:""},
  {category:"學院", system:"皇家書院／蘭臺女院", position:"女院教習", rank:"教習", quota:0, note:""},
  {category:"學院", system:"皇家書院／觀政齋", position:"觀政教習", rank:"教習", quota:0, note:""},
  {category:"學院", system:"皇家書院／外藩館", position:"外藩館教習", rank:"教習", quota:0, note:""},
  {category:"學院", system:"女史院", position:"禮制課教習", rank:"教習", quota:0, note:""},
  {category:"學院", system:"慕容家學／青梧書院", position:"男學教習", rank:"家學教習", quota:0, note:""},
  {category:"學院", system:"慕容家學／秋水女塾", position:"女學教習", rank:"家學教習", quota:0, note:""},
  {category:"學院", system:"慕容家學／立雪齋", position:"禮法教習", rank:"家學教習", quota:0, note:""},
  {category:"學院", system:"慕容家學／衡蘭堂", position:"帳冊財務教習", rank:"家學教習", quota:0, note:""},
  {category:"學院", system:"慕容家學／藏鋒院", position:"武學教習", rank:"家學教習", quota:0, note:""}
];
