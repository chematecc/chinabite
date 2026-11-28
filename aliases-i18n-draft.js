// =====================================================================
// aliases-i18n-draft.js — DRAFT ONLY. DO NOT MERGE UNVERIFIED.
// =====================================================================
// What this is:
//   - 440 dish-name aliases: 110 dishes x 4 languages (ko/ja/de/fr)
//   - 280 UI strings: 70 keys x 4 languages (ko/ja/de/fr)
//   - Every single entry is UNVERIFIED and marked // DRAFT.
// What this is NOT:
//   - NOT loaded by index.html (no <script> tag points here).
//   - NOT part of the live matching chain. aliases.js is untouched.
//   - NOT to be copied into aliases.js / i18n.js before a native
//     speaker has checked it line by line.
// How to merge (after verification):
//   1. A native speaker of each language checks every line for that
//      language and fixes it in place; the // DRAFT marker is removed
//      only for the lines they personally checked.
//   2. Only lines WITHOUT the // DRAFT marker may be copied into the
//      live files. A line that still says DRAFT stays out.
//   3. Dish aliases go into aliases.js (per-language sections);
//      UI strings go into i18n.js STRINGS (ko/ja/de/fr blocks).
// Sources: dish ids + en names from data.js (110 dishes);
//          UI keys + en text from i18n.js STRINGS.en (70 keys).
// Counts are verified by /tmp/domtest/multilang-draft-check.cjs
// (run after any edit): 110 dish ids, 440 aliases, 280 UI strings.
// =====================================================================
window.CHINABITE_ALIASES_I18N_DRAFT = {
  dishes: {
    // ko: Korean name a Korean speaker would type (Hangul).
    // ja: Japanese name as on a Japanese menu (kanji/kana).
    // de: German name. fr: French name.
    "mapo-tofu": { ko: "마파두부", ja: "麻婆豆腐", de: "Mapo-Tofu", fr: "Tofu Mapo" }, // DRAFT
    "kung-pao": { ko: "궁바오지딩", ja: "宮保鶏丁", de: "Kung-Pao-Hähnchen", fr: "Poulet Kung Pao" }, // DRAFT
    "yuxiang": { ko: "위샹러우스", ja: "魚香肉絲", de: "Fischduft-Schweinefleisch", fr: "Porc parfumé au poisson" }, // DRAFT
    "sweet-sour-ribs": { ko: "탕추파이구", ja: "糖醋排骨", de: "Süß-saure Schweinerippchen", fr: "Travers de porc aigre-doux" }, // DRAFT
    "xiaolongbao": { ko: "샤오롱바오", ja: "小籠包", de: "Xiaolongbao", fr: "Xiaolongbao" }, // DRAFT
    "jiaozi": { ko: "교자", ja: "餃子", de: "Jiaozi", fr: "Jiaozi" }, // DRAFT
    "lanzhou": { ko: "란저우라몐", ja: "蘭州拉麺", de: "Lanzhou-Nudeln mit Rind", fr: "Nouilles Lanzhou au bœuf" }, // DRAFT
    "zhajiang": { ko: "자장몐", ja: "炸醤麺", de: "Zhajiang-Nudeln", fr: "Nouilles Zhajiang" }, // DRAFT
    "hot-sour-soup": { ko: "쑤안라탕", ja: "酸辣湯", de: "Sauer-scharfe Suppe", fr: "Soupe aigre-piquante" }, // DRAFT
    "tomato-egg": { ko: "시훙스차오단", ja: "トマトと卵の炒め物", de: "Tomaten-Ei-Pfanne", fr: "Tomates et œufs sautés" }, // DRAFT
    "disanxian": { ko: "디싼셴", ja: "地三鮮", de: "Di-San-Xian", fr: "Di San Xian" }, // DRAFT
    "dry-pot-cauliflower": { ko: "간궈화차이", ja: "干鍋花菜", de: "Trockentopf-Blumenkohl", fr: "Chou-fleur au pot sec" }, // DRAFT
    "blanched-shrimp": { ko: "바이주어샤", ja: "白灼蝦", de: "Blanchierte Garnelen", fr: "Crevettes blanchies" }, // DRAFT
    "steamed-bass": { ko: "칭정루위", ja: "清蒸鱸魚", de: "Gedämpfter Wolfsbarsch", fr: "Bar cuit à la vapeur" }, // DRAFT
    "peking-duck": { ko: "베이징카오야", ja: "北京ダック", de: "Pekingente", fr: "Canard de Pékin" }, // DRAFT
    "hotpot": { ko: "훠궈", ja: "火鍋", de: "Hot Pot", fr: "Fondue chinoise" }, // DRAFT
    "malatang": { ko: "마라탕", ja: "麻辣湯", de: "Malatang", fr: "Malatang" }, // DRAFT
    "jianbing": { ko: "젠빙궈즈", ja: "煎餅果子", de: "Jianbing", fr: "Crêpe chinoise Jianbing" }, // DRAFT
    "doufunao": { ko: "더우푸나오", ja: "豆腐脳", de: "Doufunao", fr: "Doufunao" }, // DRAFT
    "yangzhou-rice": { ko: "양저우차오판", ja: "揚州炒飯", de: "Yangzhou-Reis", fr: "Riz sauté Yangzhou" }, // DRAFT
    "shuizhu-beef": { ko: "수이저우뉴러우", ja: "水煮牛肉", de: "Shuizhu-Rindfleisch", fr: "Bœuf Shuizhu" }, // DRAFT
    "shuizhu-fish": { ko: "수이저우위", ja: "水煮魚", de: "Shuizhu-Fisch", fr: "Poisson Shuizhu" }, // DRAFT
    "maoxuewang": { ko: "마오쉐왕", ja: "毛血旺", de: "Mao-Xue-Wang", fr: "Mao Xue Wang" }, // DRAFT
    "huiguo-pork": { ko: "후이궈러우", ja: "回鍋肉", de: "Zweimal gebratenes Schweinefleisch", fr: "Porc deux fois cuit" }, // DRAFT
    "lazi-chicken": { ko: "라쯔지", ja: "辣子鶏", de: "Lazi-Hähnchen", fr: "Poulet Lazi" }, // DRAFT
    "fuqi-feipian": { ko: "푸치페이폔", ja: "夫妻肺片", de: "Fuqi-Feipian", fr: "Fuqi Feipian" }, // DRAFT
    "koushui-chicken": { ko: "커우수이지", ja: "口水鶏", de: "Koushui-Hähnchen", fr: "Poulet Koushui" }, // DRAFT
    "suancai-fish": { ko: "쑤안차이위", ja: "酸菜魚", de: "Fisch mit eingelegtem Senfkohl", fr: "Poisson au chou fermenté" }, // DRAFT
    "drypot-frog": { ko: "간궈니우와", ja: "干鍋牛蛙", de: "Trockentopf-Frosch", fr: "Grenouille au pot sec" }, // DRAFT
    "mala-xiangguo": { ko: "마라샹궈", ja: "麻辣香鍋", de: "Mala-Xiangguo", fr: "Mala Xiangguo" }, // DRAFT
    "bobo-chicken": { ko: "보보지", ja: "钵钵鶏", de: "Bobo-Hähnchen", fr: "Poulet Bobo" }, // DRAFT
    "liangban-cucumber": { ko: "량반황과", ja: "涼拌胡瓜", de: "Kalter Gurkensalat", fr: "Concombre froid" }, // DRAFT
    "baiqie-chicken": { ko: "바이체지", ja: "白切鶏", de: "Weißes Hähnchen", fr: "Poulet blanc coupé" }, // DRAFT
    "shao-e": { ko: "사오어", ja: "焼きガチョウ", de: "Gebratene Gans", fr: "Oie rôtie" }, // DRAFT
    "chashao-bao": { ko: "차사오바오", ja: "チャーシュー饅", de: "Char-Siu-Brötchen", fr: "Brioche Char Siu" }, // DRAFT
    "xiajiao": { ko: "샤자오", ja: "蝦餃", de: "Garnelen-Dumplings", fr: "Raviolis aux crevettes" }, // DRAFT
    "changfen": { ko: "창펀", ja: "腸粉", de: "Cheung-Fun", fr: "Rouleaux de riz Cheung Fun" }, // DRAFT
    "tingzai-zhou": { ko: "팅자이저우", ja: "艇仔粥", de: "Tingzai-Congee", fr: "Congee Tingzai" }, // DRAFT
    "jidi-zhou": { ko: "지디저우", ja: "及第粥", de: "Jidi-Congee", fr: "Congee Jidi" }, // DRAFT
    "luobo-gao": { ko: "뤄보가오", ja: "大根餅", de: "Rettichkuchen", fr: "Gâteau de radis" }, // DRAFT
    "mala-gao": { ko: "마라가오", ja: "マーラーカオ", de: "Malay-Kuchen", fr: "Gâteau malais" }, // DRAFT
    "liusha-bao": { ko: "류사바오", ja: "流沙包", de: "Liusha-Brötchen", fr: "Brioche au jaune d'œuf coulant" }, // DRAFT
    "furu-tongcai": { ko: "푸루퉁차이", ja: "腐乳通菜", de: "Wasserspinat mit fermentiertem Tofu", fr: "Liseron d'eau au tofu fermenté" }, // DRAFT
    "dahu-mian": { ko: "다루몐", ja: "打滷麺", de: "Dalu-Nudeln", fr: "Nouilles Dalu" }, // DRAFT
    "daoxiao-mian": { ko: "다오샤오몐", ja: "刀削麺", de: "Daoxiao-Nudeln", fr: "Nouilles Daoxiao" }, // DRAFT
    "youpo-mian": { ko: "유포몐", ja: "油泼麺", de: "Youpo-Nudeln", fr: "Nouilles Youpo" }, // DRAFT
    "dandan-mian": { ko: "단단몐", ja: "担々麺", de: "Dan-Dan-Nudeln", fr: "Nouilles Dan Dan" }, // DRAFT
    "chongqing-noodles": { ko: "충칭샤오몐", ja: "重慶小麺", de: "Chongqing-Nudeln", fr: "Nouilles Chongqing" }, // DRAFT
    "regan-mian": { ko: "러간몐", ja: "熱乾麺", de: "Regan-Nudeln", fr: "Nouilles Regan" }, // DRAFT
    "niurou-mian": { ko: "뉴러우몐", ja: "牛肉麺", de: "Rindfleisch-Nudeln", fr: "Nouilles au bœuf" }, // DRAFT
    "yangrou-paomo": { ko: "양러우파오모", ja: "羊肉泡饃", de: "Yangrou-Paomo", fr: "Paomo à l'agneau" }, // DRAFT
    "roujiamo": { ko: "러우자모", ja: "肉夾饃", de: "Roujiamo", fr: "Roujiamo" }, // DRAFT
    "jian-bing": { ko: "젠빙", ja: "煎餅", de: "Jianbing-Pfannkuchen", fr: "Galette Jianbing" }, // DRAFT
    "congyou-bing": { ko: "충유빙", ja: "葱油餅", de: "Frühlingszwiebel-Pfannkuchen", fr: "Galette à l'oignon vert" }, // DRAFT
    "guotie": { ko: "궈톄", ja: "鍋貼", de: "Guotie", fr: "Guotie" }, // DRAFT
    "mapo-tofu-veg": { ko: "마파두부 채식", ja: "麻婆豆腐（肉なし）", de: "Mapo-Tofu ohne Fleisch", fr: "Tofu Mapo sans viande" }, // DRAFT
    "ganbian-sijidou": { ko: "간볜스지더우", ja: "干煸四季豆", de: "Trocken gebratene grüne Bohnen", fr: "Haricots verts secs sautés" }, // DRAFT
    "suanrong-xilanhua": { ko: "쑤안룽시란화", ja: "蒜蓉西蘭花", de: "Brokkoli mit Knoblauch", fr: "Brocoli à l'ail" }, // DRAFT
    "qingchao-shishu": { ko: "칭차오스수", ja: "清炒時蔬", de: "Gebratenes Saisongemüse", fr: "Légumes de saison sautés" }, // DRAFT
    "suchao-sansi": { ko: "쑤차오싼스", ja: "素炒三絲", de: "Drei gebratene Gemüse", fr: "Trois légumes sautés" }, // DRAFT
    "liangban-muer": { ko: "량반무얼", ja: "涼拌木耳", de: "Kalter Holzohr-Salat", fr: "Oreilles de bois froides" }, // DRAFT
    "fanqie-danhua-tang": { ko: "판체단화탕", ja: "番茄蛋花湯", de: "Tomaten-Eierflockensuppe", fr: "Soupe tomate et œuf" }, // DRAFT
    "zicai-danhua-tang": { ko: "쯔차이단화탕", ja: "紫菜蛋花湯", de: "Algen-Eierflockensuppe", fr: "Soupe aux algues et œuf" }, // DRAFT
    "luohan-zhai": { ko: "뤄한자이", ja: "羅漢斎", de: "Luohan-Zhai", fr: "Luohan Zhai" }, // DRAFT
    "xianggu-qingcai": { ko: "샹구칭차이", ja: "香菇青菜", de: "Shiitake mit Grünzeug", fr: "Shiitakés et légumes verts" }, // DRAFT
    "yangrou-chuan": { ko: "양러우촨", ja: "羊肉串", de: "Lammspieße", fr: "Brochettes d'agneau" }, // DRAFT
    "kao-baozi": { ko: "카오바오즈", ja: "焼き包子", de: "Gebackene Lammbrötchen", fr: "Brioches d'agneau au four" }, // DRAFT
    "shouzhuafan": { ko: "서우자판", ja: "手抓飯", de: "Shouzhuafan", fr: "Riz Shouzhuafan" }, // DRAFT
    "dapanji": { ko: "다판지", ja: "大盤鶏", de: "Dapanji", fr: "Dapanji" }, // DRAFT
    "halal-beef-noodles": { ko: "칭전뉴러우몐", ja: "清真牛肉麺", de: "Halal-Rindfleisch-Nudeln", fr: "Nouilles halal au bœuf" }, // DRAFT
    "yangrou-tang": { ko: "양러우탕", ja: "羊肉湯", de: "Lammsuppe", fr: "Soupe d'agneau" }, // DRAFT
    "ziran-yangrou": { ko: "쯔란양러우", ja: "孜然羊肉", de: "Lamm mit Kreuzkümmel", fr: "Agneau au cumin" }, // DRAFT
    "nang": { ko: "낭", ja: "ナン", de: "Nang", fr: "Nang" }, // DRAFT
    "hongshao-rou": { ko: "훙사오러우", ja: "紅焼肉", de: "Rot geschmortes Schweinefleisch", fr: "Porc braisé" }, // DRAFT
    "shengjian-bao": { ko: "성젠바오", ja: "生煎包", de: "Shengjian-Brötchen", fr: "Brioches Shengjian" }, // DRAFT
    "congyou-banmian": { ko: "충유반몐", ja: "葱油拌麺", de: "Congyou-Banmian", fr: "Nouilles à l'oignon vert" }, // DRAFT
    "yandu-xian": { ko: "옌두셴", ja: "腌篤鮮", de: "Yandu-Xian", fr: "Yandu Xian" }, // DRAFT
    "xiangyou-shanhu": { ko: "샹유산후", ja: "響油鱔糊", de: "Sizzling-Aal", fr: "Anguille grésillante" }, // DRAFT
    "tangcu-xiaopai": { ko: "탕추샤오파이", ja: "糖醋小排", de: "Süß-saure Rippchen", fr: "Petites côtes aigre-douces" }, // DRAFT
    "shizitou": { ko: "스쯔터우", ja: "獅子頭", de: "Löwenkopf-Fleischbällchen", fr: "Boulettes Tête de lion" }, // DRAFT
    "guihua-tangou": { ko: "계화탕우", ja: "桂花糖藕", de: "Guihua Tangou", fr: "Guihua Tangou" }, // DRAFT
    "songshu-guiyu": { ko: "쑹수구이위", ja: "松鼠桂魚", de: "Eichhörnchen-Fisch", fr: "Poisson Écureuil" }, // DRAFT
    "xiefen-xiaolong": { ko: "셰펀샤오룽", ja: "蟹粉小籠", de: "Xiaolongbao mit Krabbenrogen", fr: "Xiaolongbao au crabe" }, // DRAFT
    "qingtang-huoguo": { ko: "칭탕훠궈", ja: "清湯火鍋", de: "Klare Hot-Pot-Brühe", fr: "Fondue au bouillon clair" }, // DRAFT
    "fanqie-huoguo": { ko: "판체훠궈", ja: "番茄火鍋", de: "Tomaten-Hot-Pot", fr: "Fondue à la tomate" }, // DRAFT
    "juntang-huoguo": { ko: "쥔탕훠궈", ja: "菌湯火鍋", de: "Pilz-Hot-Pot", fr: "Fondue aux champignons" }, // DRAFT
    "kao-yangrou-chuan": { ko: "카오양러우촨", ja: "焼き羊肉串", de: "Gegrillte Lammspieße", fr: "Brochettes d'agneau grillées" }, // DRAFT
    "kao-qiezi": { ko: "카오체즈", ja: "焼き茄子", de: "Gegrillte Aubergine", fr: "Aubergine grillée" }, // DRAFT
    "kao-shenghao": { ko: "카오성하오", ja: "焼き牡蠣", de: "Gegrillte Austern", fr: "Huîtres grillées" }, // DRAFT
    "kao-yumi": { ko: "카오위미", ja: "焼きトウモロコシ", de: "Gegrillter Mais", fr: "Maïs grillé" }, // DRAFT
    "kao-hongshu": { ko: "카오훙수", ja: "焼き芋", de: "Gebackene Süßkartoffel", fr: "Patate douce rôtie" }, // DRAFT
    "douhua": { ko: "더우화", ja: "豆花", de: "Douhua", fr: "Douhua" }, // DRAFT
    "yangzhi-ganlu": { ko: "양즈간루", ja: "楊枝甘露", de: "Yangzhi-Ganlu", fr: "Yangzhi Ganlu" }, // DRAFT
    "shuangpi-nai": { ko: "솽피나이", ja: "双皮奶", de: "Shuangpi-Nai", fr: "Shuangpi Nai" }, // DRAFT
    "jiangzhuang-nai": { ko: "장좡나이", ja: "姜撞奶", de: "Jiangzhuang-Nai", fr: "Jiangzhuang Nai" }, // DRAFT
    "liangfen": { ko: "량펀", ja: "涼粉", de: "Liangfen", fr: "Liangfen" }, // DRAFT
    "bingfen": { ko: "빙펀", ja: "冰粉", de: "Bingfen", fr: "Bingfen" }, // DRAFT
    "doujiang": { ko: "더우장", ja: "豆漿", de: "Sojamilch", fr: "Lait de soja" }, // DRAFT
    "suanmeitang": { ko: "쑤안메이탕", ja: "酸梅湯", de: "Suanmeitang", fr: "Suanmeitang" }, // DRAFT
    "guoqiao-mixian": { ko: "궈차오미셴", ja: "過橋米線", de: "Guoqiao-Mixian", fr: "Mixian Guoqiao" }, // DRAFT
    "guilin-mifen": { ko: "구이린미펀", ja: "桂林米粉", de: "Guilin-Mifen", fr: "Mifen de Guilin" }, // DRAFT
    "chaoshan-beef-balls": { ko: "차오산뉴러우완", ja: "潮汕牛肉丸", de: "Chaoshan-Rindfleischbällchen", fr: "Boulettes de bœuf Chaoshan" }, // DRAFT
    "xian-liangpi": { ko: "시안량피", ja: "西安涼皮", de: "Xi'an-Liangpi", fr: "Liangpi de Xi'an" }, // DRAFT
    "shaxian-bianrou": { ko: "사셴볜러우", ja: "沙県扁肉", de: "Shaxian-Bianrou", fr: "Bianrou de Shaxian" }, // DRAFT
    "liuzhou-luoshifen": { ko: "류저우뤄스펀", ja: "柳州螺螄粉", de: "Liuzhou-Luosifen", fr: "Luosifen de Liuzhou" }, // DRAFT
    "nanjing-yaxue-fensi": { ko: "난징야쉐펀스탕", ja: "南京鴨血粉絲湯", de: "Nanjing-Entenblut-Nudelsuppe", fr: "Soupe de Nankin au sang de canard" }, // DRAFT
    "chengdu-zhongshuijiao": { ko: "청두중수이자오", ja: "成都鍾水餃", de: "Chengdu-Zhong-Dumplings", fr: "Raviolis Zhong de Chengdu" }, // DRAFT
    "guangzhou-wonton": { ko: "광저우윈툰몐", ja: "広州雲吞麺", de: "Guangzhou-Wonton-Nudeln", fr: "Nouilles wonton de Canton" }, // DRAFT
    "hangzhou-dongporou": { ko: "항저우둥포러우", ja: "杭州東坡肉", de: "Hangzhou-Dongpo-Schweinefleisch", fr: "Porc Dongpo de Hangzhou" } // DRAFT
  },
  ui: {
    // Same 70 keys as i18n.js STRINGS.en. {list} / {n} / {q} / {dish}
    // / {count} placeholders are kept verbatim in every language.
    ko: {
      "verdict.ok": "먹어도 돼요", // DRAFT
      "verdict.no": "이건 패스하세요", // DRAFT
      "verdict.ask": "먼저 물어보세요", // DRAFT
      "verdict.spicy": "당신에겐 너무 매워요", // DRAFT
      "label.why": "이유는요:", // DRAFT
      "label.whatsIn": "뭐가 들었어요:", // DRAFT
      "label.headsUp": "주의:", // DRAFT
      "label.howHot": "얼마나 매워요:", // DRAFT
      "label.watch": "조심할 것:", // DRAFT
      "label.about": "가격:", // DRAFT
      "label.showThem": "이걸 보여주세요:", // DRAFT
      "btn.addOrder": "주문에 추가", // DRAFT
      "btn.delivery": "배달시키기", // DRAFT
      "btn.qr": "QR로 주문하는 법", // DRAFT
      "btn.dietCard": "직원에게 식단 카드 보여주기", // DRAFT
      "btn.showBig": "크게 보기", // DRAFT
      "btn.waiterCard": "내 직원 카드 보기", // DRAFT
      "next.pick": "다음 · 하나 고르기", // DRAFT
      "contains.none": "숨어 있는 건 없어요.", // DRAFT
      "contains.has": "{list} 들어 있어요.", // DRAFT
      "flag.pork": "돼지고기", // DRAFT
      "flag.lard": "라드", // DRAFT
      "flag.stock": "육수", // DRAFT
      "flag.peanut": "땅콩", // DRAFT
      "flag.shrimp": "새우", // DRAFT
      "flag.gluten": "밀(글루텐)", // DRAFT
      "flag.soy": "대두", // DRAFT
      "flag.egg": "달걀", // DRAFT
      "flag.dairy": "유제품", // DRAFT
      "flag.beef": "소고기", // DRAFT
      "flag.chicken": "닭고기", // DRAFT
      "flag.fish": "생선", // DRAFT
      "flag.lamb": "양고기", // DRAFT
      "flag.duck": "오리고기", // DRAFT
      "flag.goose": "거위고기", // DRAFT
      "flag.frog": "개구리", // DRAFT
      "flag.alcohol": "알코올", // DRAFT
      "spice.0": "안 매워요", // DRAFT
      "spice.1": "약간 매워요", // DRAFT
      "spice.2": "중간 매워요", // DRAFT
      "spice.3": "아주 매워요", // DRAFT
      "why.vegMeat": "고기가 들어 있어요. {contains}", // DRAFT
      "why.vegLard": "라드나 육수가 들어 있을 수 있어요 — 한 번 물어보는 게 좋아요.", // DRAFT
      "why.vegEgg": "달걀은 괜찮아요. {contains}", // DRAFT
      "why.vegan": "동물성 재료가 들어 있어요. {contains}", // DRAFT
      "why.halalPork": "돼지고기나 라드 — 할랄이 아니에요. {contains}", // DRAFT
      "why.halalMeat": "고기예요 — 할랄인지 물어보거나 초록색 清真 표시를 찾아보세요.", // DRAFT
      "why.peanut": "땅콩이 이 요리의 핵심이에요. 위험해요.", // DRAFT
      "why.peanutStock": "요리 자체엔 땅콩이 없어요 — 그래도 소스는 한 번 물어보세요.", // DRAFT
      "why.shellfish": "조개류가 들어 있어요. 위험해요.", // DRAFT
      "why.shellfishStock": "요리엔 조개류가 없어요 — 하지만 육수에 있을 수 있어요. 한 번 물어보세요.", // DRAFT
      "why.gluten": "밀이 들어 있어요. {contains}", // DRAFT
      "why.spicyHigh": "매운맛 {n}/3 — 이건 세게 와요.", // DRAFT
      "why.spicyMild": "조금 매워요 — 고추 빼달라고 하세요.", // DRAFT
      "why.spicyNone": "전혀 안 매워요. {contains}", // DRAFT
      "decode.emptyTitle": "뭘 확인할까요?", // DRAFT
      "decode.emptyBody": "요리 이름을 입력하세요 — 마파두부나 番茄炒蛋를 해보세요. 아래 요리를 눌러도 3초 안에 알려드릴게요.", // DRAFT
      "decode.looking": "찾고 있어요…", // DRAFT
      "dym.title": "{dish} 말씀이세요?", // DRAFT
      "dym.body": "“{q}”라고 입력하셨죠 — 목록에서 가장 가까운 건 이거예요.", // DRAFT
      "dym.yes": "맞아요 — 이 요리 확인하기", // DRAFT
      "dym.no": "아니요 — 비슷한 요리 보여주기", // DRAFT
      "nomatch.title": "음, 아직 목록에 없어요", // DRAFT
      "nomatch.body": "제가 아는 요리는 {count}개 — “{q}”는 아직 없어요. 아직은요.", // DRAFT
      "nomatch.saved": "휴대폰에 저장했어요. 추가할게요.", // DRAFT
      "nomatch.askBun": "Bun에게 물어보기 — AI로 확인해 줄게요", // DRAFT
      "nomatch.browse": "110개 요리 모두 보기", // DRAFT
      "nomatch.tryAnother": "다른 이름으로 해보세요 — 番茄는 西红柿이기도 하고, 馄饨은 抄手이기도 해요. 메뉴 사진을 찍으면 읽어드릴게요.", // DRAFT
      "nomatch.didYouMean": "혹시 이거?", // DRAFT
      "toast.pickDiet": "먼저 식단을 고르세요 — 위 칩을 눌러주세요." // DRAFT
    },
    ja: {
      "verdict.ok": "大丈夫です", // DRAFT
      "verdict.no": "これはやめておいて", // DRAFT
      "verdict.ask": "まず聞いてみて", // DRAFT
      "verdict.spicy": "あなたには辛すぎます", // DRAFT
      "label.why": "理由はこちら：", // DRAFT
      "label.whatsIn": "入っているもの：", // DRAFT
      "label.headsUp": "注意：", // DRAFT
      "label.howHot": "辛さ：", // DRAFT
      "label.watch": "注意点：", // DRAFT
      "label.about": "価格：", // DRAFT
      "label.showThem": "これを見せて：", // DRAFT
      "btn.addOrder": "注文に追加", // DRAFT
      "btn.delivery": "デリバリーで頼む", // DRAFT
      "btn.qr": "QRでの注文方法", // DRAFT
      "btn.dietCard": "店員に食事カードを見せる", // DRAFT
      "btn.showBig": "大きく表示", // DRAFT
      "btn.waiterCard": "店員用カードを表示", // DRAFT
      "next.pick": "次へ · ひとつ選ぶ", // DRAFT
      "contains.none": "隠れたものはありません。", // DRAFT
      "contains.has": "{list}が入っています。", // DRAFT
      "flag.pork": "豚肉", // DRAFT
      "flag.lard": "ラード", // DRAFT
      "flag.stock": "肉の出汁", // DRAFT
      "flag.peanut": "ピーナッツ", // DRAFT
      "flag.shrimp": "エビ", // DRAFT
      "flag.gluten": "小麦（グルテン）", // DRAFT
      "flag.soy": "大豆", // DRAFT
      "flag.egg": "卵", // DRAFT
      "flag.dairy": "乳製品", // DRAFT
      "flag.beef": "牛肉", // DRAFT
      "flag.chicken": "鶏肉", // DRAFT
      "flag.fish": "魚", // DRAFT
      "flag.lamb": "羊肉", // DRAFT
      "flag.duck": "鴨肉", // DRAFT
      "flag.goose": "ガチョウ", // DRAFT
      "flag.frog": "カエル", // DRAFT
      "flag.alcohol": "アルコール", // DRAFT
      "spice.0": "辛くない", // DRAFT
      "spice.1": "少し辛い", // DRAFT
      "spice.2": "中辛", // DRAFT
      "spice.3": "とても辛い", // DRAFT
      "why.vegMeat": "肉が入っています。{contains}", // DRAFT
      "why.vegLard": "ラードや肉の出汁が入っているかも — ひとこと聞いてみて。", // DRAFT
      "why.vegEgg": "卵は大丈夫です。{contains}", // DRAFT
      "why.vegan": "動物性のものが入っています。{contains}", // DRAFT
      "why.halalPork": "豚肉かラード — ハラルではありません。{contains}", // DRAFT
      "why.halalMeat": "肉です — ハラルか聞くか、緑の清真マークを探して。", // DRAFT
      "why.peanut": "ピーナッツが主役の料理です。やめておいて。", // DRAFT
      "why.peanutStock": "料理自体にピーナッツはありません — でもソースは念のため聞いてみて。", // DRAFT
      "why.shellfish": "貝類が入っています。やめておいて。", // DRAFT
      "why.shellfishStock": "料理に貝類はありません — でも出汁に入っているかも。ひとこと聞いてみて。", // DRAFT
      "why.gluten": "小麦が入っています。{contains}", // DRAFT
      "why.spicyHigh": "辛さ {n}/3 — これはきますよ。", // DRAFT
      "why.spicyMild": "ちょっと辛いだけ — 唐辛子抜きで頼んでみて。", // DRAFT
      "why.spicyNone": "全然辛くありません。{contains}", // DRAFT
      "decode.emptyTitle": "何をチェックする？", // DRAFT
      "decode.emptyBody": "料理名を入力して — 麻婆豆腐や番茄炒蛋で試してみて。下の料理をタップしても、3秒でお答えします。", // DRAFT
      "decode.looking": "調べています…", // DRAFT
      "dym.title": "{dish}のことですか？", // DRAFT
      "dym.body": "「{q}」と入力しましたね — リストで一番近いのはこれです。", // DRAFT
      "dym.yes": "そう — この料理をチェック", // DRAFT
      "dym.no": "いいえ — 似た料理を見せる", // DRAFT
      "nomatch.title": "うーん、まだリストにありません", // DRAFT
      "nomatch.body": "知っている料理は{count}品 — 「{q}」はまだありません。まだ、ですが。", // DRAFT
      "nomatch.saved": "スマホに保存しました。追加しますね。", // DRAFT
      "nomatch.askBun": "Bunに聞く — AIでチェックします", // DRAFT
      "nomatch.browse": "110品すべて見る", // DRAFT
      "nomatch.tryAnother": "別の名前で試してみて — 番茄は西红柿でもあり、馄饨は抄手でもあります。メニューの写真を撮れば読み取りますよ。", // DRAFT
      "nomatch.didYouMean": "もしかして…", // DRAFT
      "toast.pickDiet": "まず食事制限を選んで — 上のチップをタップして。" // DRAFT
    },
    de: {
      "verdict.ok": "Passt für dich", // DRAFT
      "verdict.no": "Lieber nicht", // DRAFT
      "verdict.ask": "Frag erst nach", // DRAFT
      "verdict.spicy": "Zu scharf für dich", // DRAFT
      "label.why": "Warum:", // DRAFT
      "label.whatsIn": "Was drin ist:", // DRAFT
      "label.headsUp": "Achtung:", // DRAFT
      "label.howHot": "Wie scharf:", // DRAFT
      "label.watch": "Aufpassen:", // DRAFT
      "label.about": "Preis:", // DRAFT
      "label.showThem": "Zeig ihnen das:", // DRAFT
      "btn.addOrder": "Zur Bestellung", // DRAFT
      "btn.delivery": "Liefern lassen", // DRAFT
      "btn.qr": "Per QR bestellen", // DRAFT
      "btn.dietCard": "Diätkarte dem Kellner zeigen", // DRAFT
      "btn.showBig": "Groß anzeigen", // DRAFT
      "btn.waiterCard": "Meine Kellnerkarte zeigen", // DRAFT
      "next.pick": "Weiter · eins wählen", // DRAFT
      "contains.none": "Nichts Verstecktes drin.", // DRAFT
      "contains.has": "Enthält {list}.", // DRAFT
      "flag.pork": "Schweinefleisch", // DRAFT
      "flag.lard": "Schmalz", // DRAFT
      "flag.stock": "Fleischbrühe", // DRAFT
      "flag.peanut": "Erdnüsse", // DRAFT
      "flag.shrimp": "Garnelen", // DRAFT
      "flag.gluten": "Weizen (Gluten)", // DRAFT
      "flag.soy": "Soja", // DRAFT
      "flag.egg": "Ei", // DRAFT
      "flag.dairy": "Milchprodukte", // DRAFT
      "flag.beef": "Rindfleisch", // DRAFT
      "flag.chicken": "Hähnchen", // DRAFT
      "flag.fish": "Fisch", // DRAFT
      "flag.lamb": "Lamm", // DRAFT
      "flag.duck": "Ente", // DRAFT
      "flag.goose": "Gans", // DRAFT
      "flag.frog": "Frosch", // DRAFT
      "flag.alcohol": "Alkohol", // DRAFT
      "spice.0": "Nicht scharf", // DRAFT
      "spice.1": "Mild", // DRAFT
      "spice.2": "Mittelscharf", // DRAFT
      "spice.3": "Sehr scharf", // DRAFT
      "why.vegMeat": "Da ist Fleisch drin. {contains}", // DRAFT
      "why.vegLard": "Könnte Schmalz oder Fleischbrühe drin sein — frag kurz nach.", // DRAFT
      "why.vegEgg": "Ei ist für dich okay. {contains}", // DRAFT
      "why.vegan": "Tierisches Produkt drin. {contains}", // DRAFT
      "why.halalPork": "Schweinefleisch oder Schmalz — nicht halal. {contains}", // DRAFT
      "why.halalMeat": "Es ist Fleisch — frag, ob es halal ist, oder such das grüne 清真-Schild.", // DRAFT
      "why.peanut": "Erdnüsse sind hier die Hauptsache. Nicht riskieren.", // DRAFT
      "why.peanutStock": "Im Gericht selbst keine Erdnüsse — frag aber sicherheitshalber nach der Soße.", // DRAFT
      "why.shellfish": "Schalen-/Krustentiere drin. Nicht riskieren.", // DRAFT
      "why.shellfishStock": "Im Gericht keine Schalen-/Krustentiere — aber die Brühe könnte welche haben. Frag kurz nach.", // DRAFT
      "why.gluten": "Weizen drin. {contains}", // DRAFT
      "why.spicyHigh": "Schärfe {n}/3 — das hier beißt zurück.", // DRAFT
      "why.spicyMild": "Nur ein bisschen scharf — bitte ohne Chili bestellen.", // DRAFT
      "why.spicyNone": "Gar nicht scharf. {contains}", // DRAFT
      "decode.emptyTitle": "Was checken wir?", // DRAFT
      "decode.emptyBody": "Tipp einen Gerichtenamen — probier Mapo-Tofu oder 番茄炒蛋. Oder tipp unten ein Gericht an, in 3 Sekunden weißt du Bescheid.", // DRAFT
      "decode.looking": "Suche…", // DRAFT
      "dym.title": "Meintest du {dish}?", // DRAFT
      "dym.body": "Du hast „{q}“ getippt — das ist der nächste Treffer auf meiner Liste.", // DRAFT
      "dym.yes": "Ja — dieses Gericht checken", // DRAFT
      "dym.no": "Nein — ähnliche Gerichte zeigen", // DRAFT
      "nomatch.title": "Hmm, noch nicht auf meiner Liste", // DRAFT
      "nomatch.body": "Ich kenne {count} Gerichte — und „{q}“ ist keins davon. Noch nicht.", // DRAFT
      "nomatch.saved": "Ich hab's auf deinem Handy gespeichert — wir fügen es hinzu.", // DRAFT
      "nomatch.askBun": "Frag Bun — er checkt es mit KI", // DRAFT
      "nomatch.browse": "Alle 110 Gerichte ansehen", // DRAFT
      "nomatch.tryAnother": "Versuch einen anderen Namen — 番茄 ist auch 西红柿, 馄饨 ist auch 抄手. Oder fotografier die Speisekarte, ich lese sie.", // DRAFT
      "nomatch.didYouMean": "Meintest du…", // DRAFT
      "toast.pickDiet": "Wähl erst deine Ernährung — tipp oben auf einen Chip." // DRAFT
    },
    fr: {
      "verdict.ok": "C'est bon pour vous", // DRAFT
      "verdict.no": "Passez celui-ci", // DRAFT
      "verdict.ask": "Demandez d'abord", // DRAFT
      "verdict.spicy": "Trop épicé pour vous", // DRAFT
      "label.why": "Pourquoi :", // DRAFT
      "label.whatsIn": "Ce qu'il y a dedans :", // DRAFT
      "label.headsUp": "Attention :", // DRAFT
      "label.howHot": "C'est épicé comment :", // DRAFT
      "label.watch": "À surveiller :", // DRAFT
      "label.about": "Prix :", // DRAFT
      "label.showThem": "Montrez-leur ceci :", // DRAFT
      "btn.addOrder": "Ajouter à la commande", // DRAFT
      "btn.delivery": "Se faire livrer", // DRAFT
      "btn.qr": "Commander par QR code", // DRAFT
      "btn.dietCard": "Montrer la carte régime au serveur", // DRAFT
      "btn.showBig": "Afficher en grand", // DRAFT
      "btn.waiterCard": "Montrer ma carte serveur", // DRAFT
      "next.pick": "Suite · choisissez-en un", // DRAFT
      "contains.none": "Rien de caché ici.", // DRAFT
      "contains.has": "Contient {list}.", // DRAFT
      "flag.pork": "porc", // DRAFT
      "flag.lard": "saindoux", // DRAFT
      "flag.stock": "bouillon de viande", // DRAFT
      "flag.peanut": "cacahuètes", // DRAFT
      "flag.shrimp": "crevettes", // DRAFT
      "flag.gluten": "blé (gluten)", // DRAFT
      "flag.soy": "soja", // DRAFT
      "flag.egg": "œuf", // DRAFT
      "flag.dairy": "produits laitiers", // DRAFT
      "flag.beef": "bœuf", // DRAFT
      "flag.chicken": "poulet", // DRAFT
      "flag.fish": "poisson", // DRAFT
      "flag.lamb": "agneau", // DRAFT
      "flag.duck": "canard", // DRAFT
      "flag.goose": "oie", // DRAFT
      "flag.frog": "grenouille", // DRAFT
      "flag.alcohol": "alcool", // DRAFT
      "spice.0": "Pas épicé", // DRAFT
      "spice.1": "Légèrement épicé", // DRAFT
      "spice.2": "Moyennement épicé", // DRAFT
      "spice.3": "Très épicé", // DRAFT
      "why.vegMeat": "Il y a de la viande dedans. {contains}", // DRAFT
      "why.vegLard": "Il pourrait y avoir du saindoux ou du bouillon de viande — posez la question.", // DRAFT
      "why.vegEgg": "L'œuf, ça va pour vous. {contains}", // DRAFT
      "why.vegan": "Produit animal dedans. {contains}", // DRAFT
      "why.halalPork": "Porc ou saindoux — pas halal. {contains}", // DRAFT
      "why.halalMeat": "C'est de la viande — demandez si c'est halal, ou cherchez le panneau vert 清真.", // DRAFT
      "why.peanut": "La cacahuète est le cœur de ce plat. Ne risquez pas.", // DRAFT
      "why.peanutStock": "Pas de cacahuètes dans le plat — mais demandez pour la sauce, au cas où.", // DRAFT
      "why.shellfish": "Fruits de mer dedans. Ne risquez pas.", // DRAFT
      "why.shellfishStock": "Pas de fruits de mer dans le plat — mais le bouillon peut en contenir. Une petite question.", // DRAFT
      "why.gluten": "Du blé dedans. {contains}", // DRAFT
      "why.spicyHigh": "Épicé {n}/3 — celui-ci pique fort.", // DRAFT
      "why.spicyMild": "Juste un peu épicé — demandez sans piment.", // DRAFT
      "why.spicyNone": "Pas épicé du tout. {contains}", // DRAFT
      "decode.emptyTitle": "Qu'est-ce qu'on vérifie ?", // DRAFT
      "decode.emptyBody": "Tapez un nom de plat — essayez Tofu Mapo ou 番茄炒蛋. Ou touchez un plat ci-dessous, je vous dis tout en 3 secondes.", // DRAFT
      "decode.looking": "Je cherche…", // DRAFT
      "dym.title": "Vous vouliez dire {dish} ?", // DRAFT
      "dym.body": "Vous avez tapé « {q} » — c'est le plus proche de ma liste.", // DRAFT
      "dym.yes": "Oui — vérifier ce plat", // DRAFT
      "dym.no": "Non — montrer des plats similaires", // DRAFT
      "nomatch.title": "Hmm, pas encore sur ma liste", // DRAFT
      "nomatch.body": "Je connais {count} plats — et « {q} » n'en fait pas partie. Pas encore.", // DRAFT
      "nomatch.saved": "Je l'ai enregistré sur votre téléphone, on l'ajoutera.", // DRAFT
      "nomatch.askBun": "Demander à Bun — il vérifiera avec l'IA", // DRAFT
      "nomatch.browse": "Parcourir les 110 plats", // DRAFT
      "nomatch.tryAnother": "Essayez un autre nom — 番茄 c'est aussi 西红柿, 馄饨 c'est aussi 抄手. Ou prenez la carte en photo, je la lirai.", // DRAFT
      "nomatch.didYouMean": "Vous vouliez dire…", // DRAFT
      "toast.pickDiet": "Choisissez d'abord votre régime — touchez une pastille ci-dessus." // DRAFT
    }
  }
};
