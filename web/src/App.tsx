import { Fragment, useState, useEffect, type CSSProperties } from "react";
import { Page, Section, Steps, Properties, NumberedList, useGrokTheme } from "./kit";
import { LPS, LP_METAS, LP_LANES, type LpRow, type LpSet } from "./ranked";
import { PRO, PRO_MADE, type ProLeague } from "./pro";
// 랭크 상성 티어(ranked.ts: 3=마스터 +, 2=에메랄드 +): 화면 토글로 바꾸며, 렌더 직전에 setRkTier로 모듈 전역을 맞춥니다.
// lol.ps 데이터는 교수님 결정으로 뺌 (2026-11-13). 우리가 라이엇 API로 모은 경기만 사용
const RK_TIERS: number[] = [3, 2].filter((t: number) => !!LPS[t]);
const RK_DEFAULT = RK_TIERS[0];
let LP: LpSet = LPS[RK_DEFAULT];
let LP_META = LP_METAS[RK_DEFAULT];
function setRkTier(t: number): void { if (LPS[t]) { LP = LPS[t]; LP_META = LP_METAS[t]; } }
function tierTxt(m: { tierLabel: string; regionLabel: string }): string { return `${m.tierLabel} · ${m.regionLabel}`; }

type Side = "B" | "R"; // map side (colour)
type Ord = "F" | "L"; // draft order: first-pick team / last-pick team
type Pos = "T" | "J" | "M" | "A" | "S";
type Kind = "ban" | "pick";
type TeamKey = "A" | "B";
type Diff = "easy" | "normal" | "pro";
interface Pro { P: number; W: number; B: number; pos: number[]; fp: number; b1: number; b2: number; rp: number; rb: number }
interface Champ { i: number; id: string; name: string; tags: string; pos: Pos[]; inferred: boolean; dmg: string; ranged: boolean; d: number; u: number; c: number; m: number; ut: number; pro: Pro | null; gd: number[] | null }
interface Step { side: Ord; kind: Kind; n: number }
interface Act { id: string; by: "human" | "ai" | "timeout"; reason?: string }
interface SetRecord { no: number; blueName: string; redName: string; blueKey: TeamKey; firstSide: Side; acts: Act[] }
interface Reason { t: string; v: number; warn?: boolean }
interface Rec { id: string; score: number; pos: Pos | null; reasons: Reason[] }

const PATCH = "16.22.1";
// 프로 데이터는 리그 선택에 따라 applyLeague()가 채움 (Oracle's Elixir, 2026-11-13)
let NG = 0;
let NR = 0;
let BLUE_W = 0;
const C = { bg: "#060A11", panel: "#0B111B", panel2: "#101826", panel3: "#151F30", line: "rgba(148,163,184,0.13)", line2: "rgba(148,163,184,0.26)", text: "#EAF0F7", sub: "#B4C0D0", dim: "#8C9AB0", teal: "#2DD4BF", gold: "#E9C46A", good: "#34D399", warn: "#FBBF24", bad: "#F87171" };
const TEAM: Record<Side, string> = { B: "#3B82F6", R: "#EF4444" };
const HI: Record<Side, string> = { B: "#8AB8FF", R: "#FF9A9A" };

const DATA = `Garen|가렌|FT|T*|PL|23111||;Galio|갈리오|TM|MT|ML|23321|60,35,46,10,0,50,0,0,2,20,26,36,33|46,-240;Gangplank|갱플랭크|F|T*|PL|31112|2,1,0,2,0,0,0,0,0,0,0,1,0|1,703;Gragas|그라가스|FM|T|ML|23321|8,2,1,8,0,0,0,0,0,0,1,4,1|8,-216;Graves|그레이브즈|K|J*|PR|32122||;Gwen|그웬|F|T|ML|32131|35,22,38,35,0,0,0,0,2,12,26,9,2|33,-172;Gnar|나르|FT|T|PR|23221|118,69,61,118,0,0,0,0,6,13,48,36,21|105,52;Nami|나미|SM|S|MR|11312|39,18,33,0,0,0,0,39,0,5,28,5,0|35,-29;Nasus|나서스|FT|T*|PL|23211|3,1,1,2,1,0,0,0,0,0,1,3,1|2,-1109;Naafiri|나피리|AF|J|PL|31131|68,32,32,2,66,0,0,0,4,2,30,39,16|60,18;Nautilus|노틸러스|TS|S|ML|13311|109,51,152,0,1,0,0,108,3,32,120,48,43|84,-133;Nocturne|녹턴|FA|J|PL|31222|92,49,271,0,92,0,0,0,19,247,24,40,151|76,-24;Nunu|누누와 윌럼프|TM|J*|ML|13212||;Nidalee|니달리|AM|TJ|MR|31132|6,5,0,3,3,0,0,0,1,0,0,3,0|6,646;Neeko|니코|MS|S|MR|31311|82,44,77,0,0,0,0,82,8,47,30,13,5|79,-23;Nilah|닐라|FA|A*|PL|31132||;Darius|다리우스|FT|T*|PL|32211||;Diana|다이애나|FA|JM*|ML|32221|1,0,1,0,0,1,0,0,0,0,1,1,1|;Draven|드레이븐|K|A*|PR|31121|3,2,5,0,0,0,3,0,0,2,3,2,5|2,-1281;Ryze|라이즈|M|M|MR|31222|155,84,83,1,0,154,0,0,35,61,22,52,22|147,-67;Rakan|라칸|S|S|ML|12333|60,33,25,0,0,0,0,60,0,2,23,23,12|47,54;Rammus|람머스|T|J*|ML|23321|1,0,0,0,1,0,0,0,0,0,0,0,0|1,88;Lux|럭스|MS|S|MR|31212|15,10,0,0,0,0,0,15,0,0,0,6,0|14,148;Rumble|럼블|FM|T|ML|32211|115,53,256,112,0,3,0,0,22,237,19,58,37|88,96;Renata|레나타 글라스크|SM|S|MR|21312|53,26,62,0,0,0,0,53,1,53,9,33,55|37,-23;Renekton|레넥톤|FT|T|PL|22221|92,41,57,92,0,0,0,0,2,11,46,18,27|83,106;Leona|레오나|TS|S|ML|13311|34,19,21,0,0,0,0,34,0,1,20,17,6|26,-69;RekSai|렉사이|FT|T|PL|22222|18,9,6,18,0,0,0,0,0,0,6,0,0|18,16;Rell|렐|TS|S|ML|13322|34,13,7,0,0,0,0,34,1,1,6,13,0|29,-38;Rengar|렝가|AF|J*|PL|31221||;Locke|로크|AM|M|ML|32131|27,12,76,0,0,27,0,0,0,42,34,27,76|14,-65;Lucian|루시안|KA|A|PR|31131|106,47,132,0,0,0,106,0,26,94,38,46,66|87,123;Lulu|룰루|SM|S|MR|21213|119,55,93,0,0,0,0,119,7,25,68,50,43|97,-28;Leblanc|르블랑|AM|M|MR|31231|15,5,27,0,0,15,0,0,1,8,19,6,6|10,669;LeeSin|리 신|FA|J|PL|32231|119,67,100,0,119,0,0,0,10,58,42,70,50|90,124;Riven|리븐|FA|T*|PL|32231||;Lissandra|리산드라|M|M|MR|31321|14,8,6,1,0,12,0,1,0,0,6,9,5|12,-284;Lillia|릴리아|FM|J*|ML|31222|2,1,0,0,2,0,0,0,0,0,0,1,0|1,-72;MasterYi|마스터 이|FA|J*|PL|31121||;Maokai|마오카이|TS|J|ML|13312|17,8,12,0,17,0,0,0,0,5,7,9,12|13,-23;Malzahar|말자하|M|M*|MR|31312|1,0,0,0,0,1,0,0,0,0,0,0,0|1,-911;Malphite|말파이트|TM|J|ML|13311|7,1,64,0,7,0,0,0,2,62,2,1,0|6,-316;Mel|멜|MS|MA|MR|31211|31,14,18,0,0,16,15,0,1,0,18,6,2|29,489;Mordekaiser|모데카이저|FM|T*|ML|32112|2,1,1,2,0,0,0,0,0,0,1,2,1|2,1250;Morgana|모르가나|SM|S*|MR|21312|1,1,0,0,0,0,0,1,0,0,0,0,0|1,798;DrMundo|문도 박사|TF|JT|XL|23111|14,6,8,3,11,0,0,0,0,2,6,3,1|14,-190;MissFortune|미스 포츈|KM|A|PR|31111|44,24,17,0,0,0,44,0,0,1,16,16,5|38,76;Milio|밀리오|SM|S|MR|11213|84,37,1,0,0,0,0,84,1,0,1,43,0|68,-55;Bard|바드|SM|S|MR|11323|100,53,209,0,0,0,0,100,16,166,43,31,67|96,-55;Varus|바루스|KM|AT|PR|31211|50,25,269,13,0,0,37,0,8,257,12,17,5|48,118;Vi|바이|FA|J|PL|22321|119,64,225,0,119,0,0,0,25,205,20,45,138|103,-55;Veigar|베이가|M|M*|MR|31311||;Vayne|베인|KA|T|PR|31221|26,15,91,26,0,0,0,0,0,20,71,11,56|24,166;Vex|벡스|M|M*|MR|32221|1,1,0,0,0,1,0,0,0,0,0,1,0|1,367;Belveth|벨베스|F|J*|PL|31231||;Velkoz|벨코즈|MS|S*|MR|31211|1,1,0,0,0,0,0,1,0,0,0,1,0|;Volibear|볼리베어|FT|JT*|XL|23221|1,1,1,1,0,0,0,0,0,0,1,1,1|;Braum|브라움|TS|S|ML|12312|16,6,7,0,0,0,0,16,0,0,7,1,0|16,-3;Briar|브라이어|FA|J*|PL|22331||;Brand|브랜드|MS|S*|MR|31211||;Vladimir|블라디미르|MF|MT*|MR|32111||;Blitzcrank|블리츠크랭크|TS|S|ML|12311|5,4,7,0,0,0,0,5,0,0,7,1,1|5,80;Viego|비에고|FA|J*|PL|31221||;Viktor|빅토르|M|M|MR|31211|74,32,30,0,0,69,5,0,7,4,26,46,20|54,-56;Poppy|뽀삐|TF|SJ|PL|23321|25,12,130,0,11,0,0,14,1,96,34,5,90|23,38;Samira|사미라|KA|A*|PR|32131||;Sion|사이온|TF|T|PL|23311|75,36,26,74,0,1,0,0,2,7,19,2,2|74,-264;Sylas|사일러스|MA|MT|ML|22131|26,11,30,4,2,20,0,0,0,8,22,8,18|20,-126;Shaco|샤코|A|J*|XL|31222||;Senna|세나|SK|A|PR|21213|6,3,2,0,0,0,6,0,0,0,2,0,0|6,-13;Seraphine|세라핀|SM|S|MR|31312|98,58,40,0,0,0,1,97,4,18,22,39,30|81,102;Sejuani|세주아니|T|J|ML|22321|15,4,3,0,15,0,0,0,0,0,3,8,2|9,-102;Sett|세트|FT|T*|PL|22221||;Sona|소나|SM|S*|MR|21212|1,1,0,0,0,0,0,1,0,0,0,0,0|1,-30;Soraka|소라카|SM|S*|MR|11213|3,1,0,0,0,0,0,3,0,0,0,1,0|3,2;Shen|쉔|T|ST|XL|23223|50,30,20,9,0,0,0,41,0,9,11,42,19|43,72;Shyvana|쉬바나|FT|J*|XL|22121|2,0,2,0,2,0,0,0,0,0,2,2,2|2,-357;Smolder|스몰더|KM|A*|PR|31111|1,0,0,0,0,1,0,0,0,0,0,0,0|1,-112;Swain|스웨인|MS|S*|MR|22211|1,1,0,0,0,1,0,0,0,0,0,1,0|;Skarner|스카너|TF|J|PL|23321|41,22,28,0,40,0,0,1,0,10,18,25,21|36,-101;Sivir|시비르|K|A|PR|31112|59,35,47,0,0,0,59,0,2,2,45,20,13|55,275;XinZhao|신 짜오|FT|J|PL|22221|141,68,71,0,141,0,0,0,13,20,51,31,22|133,-67;Syndra|신드라|M|M|MR|31211|70,34,75,0,0,70,0,0,7,39,36,58,69|47,203;Singed|신지드|TM|T*|ML|23221||;Thresh|쓰레쉬|ST|S|MR|12313|15,7,2,0,0,0,0,15,0,0,2,2,0|14,89;Ahri|아리|MA|M|MR|31231|69,42,36,0,0,69,0,0,0,3,33,26,14|61,217;Amumu|아무무|TS|J*|ML|23311||;AurelionSol|아우렐리온 솔|M|M*|MR|31221|1,0,0,0,0,1,0,0,0,0,0,0,0|1,-60;Ivern|아이번|SM|J*|MR|11323||;Azir|아지르|MK|M|MR|31221|70,33,93,0,0,70,0,0,14,60,33,4,3|70,-188;Akali|아칼리|A|M|ML|31131|62,24,123,1,0,61,0,0,1,37,86,30,62|48,1;Akshan|아크샨|KA|M*|PR|31132||;Aatrox|아트록스|F|TJ|PL|33222|29,13,1,16,12,0,1,0,1,1,0,13,0|25,-167;Aphelios|아펠리오스|K|A|PR|31211|27,14,18,0,0,0,27,0,5,4,14,3,3|25,244;Alistar|알리스타|TS|S|ML|13312|81,34,30,0,0,0,0,81,1,1,29,45,11|57,-210;Ambessa|암베사|FA|T|PL|32131|123,49,78,107,16,0,0,0,8,36,42,51,23|100,-14;Annie|애니|MS|M|MR|31312|83,46,60,1,0,82,0,0,15,20,40,28,25|77,-32;Anivia|애니비아|M|MT|MR|31312|73,31,53,12,0,53,0,8,4,22,31,24,16|65,40;Ashe|애쉬|KS|A|PR|21312|88,54,72,0,0,0,88,0,31,39,33,28,7|73,32;Yasuo|야스오|FA|MT*|PL|31232|0,0,1,0,0,0,0,0,0,0,1,0,0|;Ekko|에코|AM|JM*|ML|32231|1,1,0,0,0,1,0,0,0,0,0,0,0|1,554;Elise|엘리스|AM|S|MR|22221|11,6,5,0,0,0,0,11,0,2,3,3,0|10,281;MonkeyKing|오공|FT|J|PL|22221|84,37,55,0,84,0,0,0,5,12,43,28,29|69,-3;Aurora|오로라|MA|MT|MR|31231|83,33,39,15,0,68,0,0,8,19,20,15,4|78,72;Ornn|오른|T|T|ML|13312|21,11,3,21,0,0,0,0,0,0,3,13,1|12,-422;Orianna|오리아나|MS|M|MR|21212|107,57,324,0,0,107,0,0,19,314,10,52,110|84,1;Olaf|올라프|FT|T|PL|22211|65,41,73,63,2,0,0,0,12,42,31,57,71|47,-213;Yone|요네|FA|M|PL|31231|31,13,29,1,0,30,0,0,1,16,13,12,15|26,-250;Yorick|요릭|FT|T|PL|22212|49,23,32,49,0,0,0,0,0,7,25,15,8|47,-185;Udyr|우디르|FT|J*|XL|23221|1,0,0,1,0,0,0,0,0,0,0,1,0|1,18;Urgot|우르곳|FT|T*|PR|22211||;Warwick|워윅|FT|J*|XL|22211||;Yunara|유나라|K|A|PR|31120|136,64,60,0,0,0,136,0,28,28,32,46,7|118,-113;Yuumi|유미|SM|S|MR|11133|19,11,8,0,0,0,0,19,0,1,7,12,1|15,22;Irelia|이렐리아|FA|TM*|PL|22232|3,2,0,3,0,0,0,0,0,0,0,2,0|2,-278;Evelynn|이블린|AM|J*|ML|22122||;Ezreal|이즈리얼|KM|A|PR|11111|160,69,123,0,0,0,160,0,40,82,41,70,63|132,-127;Illaoi|일라오이|FT|T*|PL|32111|2,2,1,2,0,0,0,0,0,0,1,0,0|2,-493;JarvanIV|자르반 4세|FT|J|PL|22222|176,95,133,0,176,0,0,0,34,113,20,69,49|150,-19;Xayah|자야|K|A|PR|32311|41,23,13,0,0,0,41,0,2,3,10,22,7|30,-87;Zyra|자이라|MS|S*|MR|31311|1,0,1,0,0,1,0,0,0,0,1,0,1|1,-700;Zac|자크|TF|J*|ML|23321|1,1,0,0,1,0,0,0,0,0,0,0,0|1,-88;Zaahen|자헨|F|T|PL|22221|44,26,9,40,4,0,0,0,0,0,9,11,3|39,-85;Janna|잔나|SM|S*|MR|11313||;Jax|잭스|F|T|PL|32221|34,14,30,31,3,0,0,0,0,3,27,18,18|27,-44;Zed|제드|A|MJ*|PL|31131|1,0,0,0,1,0,0,0,0,0,0,1,0|1,-148;Xerath|제라스|MS|MS*|MR|31211||;Zeri|제리|K|A|PR|21230|15,8,10,0,0,0,15,0,1,2,8,10,6|11,-55;Jayce|제이스|FK|T|PR|31122|119,54,207,108,9,2,0,0,10,153,54,49,73|104,321;Zoe|조이|M|M|MR|31221|12,8,11,0,0,12,0,0,0,4,7,1,1|12,211;Ziggs|직스|M|A|MR|31221|43,19,38,0,0,3,40,0,2,7,31,17,17|38,-128;Jhin|진|KM|A|PR|31211|130,68,41,0,0,0,130,0,16,3,38,61,25|110,125;Zilean|질리언|SM|S*|MR|21223||;Jinx|징크스|K|A|PR|31211|7,2,0,0,0,0,7,0,0,0,0,3,0|6,141;Chogath|초가스|TM|J|ML|23211|12,6,3,1,11,0,0,0,0,0,3,12,3|10,112;Karma|카르마|MS|S|MR|21212|102,52,167,0,0,0,0,102,16,143,24,44,25|87,150;Camille|카밀|FA|ST|PL|32231|44,25,77,19,0,0,0,25,8,59,18,37,77|31,85;Kassadin|카사딘|AM|M*|ML|32131||;Karthus|카서스|M|J*|MR|31112||;Cassiopeia|카시오페아|M|M|MR|31311|73,46,210,0,0,70,3,0,15,194,16,40,142|56,224;Kaisa|카이사|KM|A|PR|31031|38,21,20,1,0,0,37,0,0,0,20,24,10|26,-46;Khazix|카직스|A|J*|PL|31121|4,2,3,0,4,0,0,0,0,1,2,1,2|4,1077;Katarina|카타리나|AM|M*|ML|31131||;Kalista|칼리스타|K|A|PR|31132|53,26,31,0,0,0,53,0,9,10,21,33,19|37,-116;Kennen|케넨|M|T|MR|31311|23,13,22,23,0,0,0,0,0,6,16,7,3|20,424;Caitlyn|케이틀린|K|A|PR|31221|81,43,95,0,0,0,81,0,7,48,47,31,38|72,94;Kayn|케인|FA|J*|PL|31131||;Kayle|케일|KM|T*|ML|31113||;KogMaw|코그모|KM|AM|XR|31111|10,7,2,0,0,4,6,0,0,0,2,5,1|7,354;Corki|코르키|KM|A|PR|31121|80,38,35,0,0,0,80,0,4,7,28,27,11|72,-206;Quinn|퀸|KA|T*|PR|31231||;KSante|크산테|TF|T|PL|23322|114,56,73,113,0,1,0,0,2,16,57,49,42|91,-165;Kled|클레드|F|T|PL|32131|13,6,5,13,0,0,0,0,0,0,5,13,5|9,143;Qiyana|키아나|A|J|PL|31221|33,14,42,0,33,0,0,0,7,37,5,30,37|11,364;Kindred|킨드레드|K|J*|PR|31232|1,1,2,0,1,0,0,0,0,0,2,1,2|1,-54;Taric|타릭|ST|S*|ML|12213||;Talon|탈론|A|J*|PL|31121||;Taliyah|탈리야|MS|M|MR|31213|77,36,23,0,0,74,3,0,5,1,22,22,15|67,-158;TahmKench|탐 켄치|TS|S|ML|23213|5,0,0,0,0,0,0,5,0,0,0,2,0|4,-21;Trundle|트런들|FT|J|PL|23112|47,30,43,3,44,0,0,0,0,14,29,22,19|36,-114;Tristana|트리스타나|KA|ATM|PR|31221|15,6,3,4,0,4,7,0,0,0,3,10,2|7,314;Tryndamere|트린다미어|FA|T*|PL|32121||;TwistedFate|트위스티드 페이트|MK|MT|MR|31222|37,18,45,7,0,30,0,0,1,3,42,12,15|34,411;Twitch|트위치|KA|A*|PR|31121|1,0,0,0,0,0,1,0,0,0,0,1,0|;Teemo|티모|KM|T*|MR|31212||;Pyke|파이크|SA|S|PL|21331|14,5,16,0,0,0,0,14,0,4,12,4,5|12,47;Pantheon|판테온|FA|J|PL|32221|142,67,126,0,139,0,0,3,25,95,31,51,43|126,-35;Fiddlesticks|피들스틱|MS|J*|MR|31311||;Fiora|피오라|FA|T*|PL|32222|1,0,0,1,0,0,0,0,0,0,0,1,0|1,-374;Fizz|피즈|AF|M*|ML|31231||;Heimerdinger|하이머딩거|MS|T*|MR|31212||;Hecarim|헤카림|FT|J*|PL|22221|2,0,0,0,2,0,0,0,0,0,0,1,0|2,636;Hwei|흐웨이|MS|M|MR|31312|7,3,2,0,0,7,0,0,0,0,2,2,0|6,-563`;



const CH: Champ[] = DATA.split(";").map((row: string, i: number): Champ => {
  const f = row.split("|");
  const ps = f[5];
  const inferred = f[3].endsWith("*");
  const pv = f[6] ? f[6].split(",").map(Number) : null;
  const pro: Pro | null = pv ? { P: pv[0], W: pv[1], B: pv[2], pos: pv.slice(3, 8), fp: pv[8], b1: pv[9], b2: pv[10], rp: pv[11], rb: pv[12] } : null;
  return { i, id: f[0], name: f[1], tags: f[2], pos: f[3].replace("*", "").split("") as Pos[], inferred, dmg: f[4][0], ranged: f[4][1] === "R", d: Number(ps[0]), u: Number(ps[1]), c: Number(ps[2]), m: Number(ps[3]), ut: Number(ps[4]), pro, gd: f[7] ? f[7].split(",").map(Number) : null };
});
const BY: Record<string, Champ> = {};
for (const c of CH) BY[c.id] = c;

const MUM = new Map<string, number[]>();
const SYM = new Map<string, number[]>();
function mu(p: number, a: number, b: number): { n: number; w: number } | null {
  const x = MUM.get(`${p}|${a}|${b}`);
  if (x) return { n: x[0], w: x[1] };
  const y = MUM.get(`${p}|${b}|${a}`);
  if (y) return { n: y[0], w: y[0] - y[1] };
  return null;
}
function syn(pa: number, a: number, pb: number, b: number): { n: number; w: number } | null {
  const lo = pa < pb;
  const x = SYM.get(lo ? `${pa}${pb}|${a}|${b}` : `${pb}${pa}|${b}|${a}`);
  return x ? { n: x[0], w: x[1] } : null;
}

const POSW: Record<number, number[]> = {};
interface Jg { n: number; fb: number; fd: number; fh: number; fv: number; gn: number; gd: number; xd: number }
const JGM: Record<number, Jg> = {};
const XMM = new Map<string, number[]>();
function xm(q: number, j: number, l: number): { n: number; w: number } | null { const x = XMM.get(`${q}|${j}|${l}`); return x ? { n: x[0], w: x[1] } : null; }

// Tournament draft order (20 steps) by draft slot: F = first-pick team, L = last-pick team.
// Since 2026 (First Selection) the map side is chosen separately, so F can be blue or red.
const SEQ = "Fb Lb Fb Lb Fb Lb Fp Lp Lp Fp Fp Lp Lb Fb Lb Fb Lp Fp Fp Lp".split(" ");
const STEPS: Step[] = (() => {
  const cnt: Record<string, number> = {};
  return SEQ.map((s: string) => {
    const side = s[0] as Ord;
    const kind: Kind = s[1] === "b" ? "ban" : "pick";
    cnt[side + kind] = (cnt[side + kind] || 0) + 1;
    return { side, kind, n: cnt[side + kind] };
  });
})();

const ALL_POS: Pos[] = ["T", "J", "M", "A", "S"];
const PI: Record<Pos, number> = { T: 0, J: 1, M: 2, A: 3, S: 4 };
const POS_KO: Record<Pos, string> = { T: "탑", J: "정글", M: "미드", A: "원딜", S: "서폿" };
const TAG_KO: Record<string, string> = { F: "전사", T: "탱커", M: "마법사", A: "암살자", K: "원거리 딜러", S: "서포터" };
const SIDE_KO: Record<Side, string> = { B: "블루", R: "레드" };
const ORD_KO: Record<Ord, string> = { F: "선픽", L: "후픽" };
let FP2: Record<string, number> = {};
const DMG_KO: Record<string, string> = { P: "물리", M: "마법", X: "혼합" };
const HINTS: string[] = [
  "선픽 팀의 첫 밴입니다. 현재 메타에서 가장 강하거나 상대 선수의 주력 챔피언을 견제하세요.",
  "후픽 팀의 첫 밴입니다. 선픽 팀이 1픽으로 가져갈 만한 챔피언을 미리 지우는 것도 방법입니다.",
  "남은 강한 챔피언 중 우리 팀이 상대하기 가장 까다로운 챔피언을 지우세요.",
  "상대 팀이 잘 다루는 챔피언이나 여러 포지션에 갈 수 있는 플렉스 챔피언을 견제해 보세요.",
  "후픽 팀이 연속 2픽으로 가져갈 조합을 떠올려 보세요.",
  "1차 밴 마지막입니다. 선픽 팀이 곧 1픽을 하므로 넘겨주기 싫은 챔피언을 지우세요.",
  "선픽 팀 1픽! 가장 강한 챔피언이나 여러 포지션이 가능한 플렉스 픽을 먼저 확보하세요.",
  "후픽 팀 연속 2픽의 첫 장입니다. 상대 1픽에 대응하거나 강한 챔피언 두 장을 연달아 챙기세요.",
  "후픽 팀 2픽입니다. 방금 고른 챔피언과 시너지가 나는 챔피언을 생각해 보세요.",
  "선픽 팀 연속 2픽의 첫 장입니다. 후픽 팀이 보여 준 두 챔피언을 보고 대응을 시작하세요.",
  "선픽 팀 3픽입니다. 포지션을 너무 일찍 드러내지 않도록 플렉스 픽도 고려해 보세요.",
  "1차 픽 마지막(후픽 팀 3픽)입니다. 조합의 핵심(이니시·주 딜러)을 완성하세요.",
  "2차 밴은 후픽 팀부터 시작합니다. 상대가 아직 채우지 못한 포지션의 핵심 챔피언을 겨냥하는 '타겟 밴'을 하세요.",
  "상대의 남은 포지션을 보고, 그 자리에 들어올 만한 챔피언을 지우세요.",
  "선픽 팀이 연속 2픽으로 완성할 조합을 막아 보세요.",
  "마지막 밴입니다. 후픽 팀의 마지막 카운터픽 후보를 지우세요.",
  "후픽 팀 4픽입니다. 남은 포지션을 채우면서 상대 라이너를 상대하기 좋은 챔피언을 고르세요.",
  "선픽 팀 연속 2픽의 첫 장입니다. 부족한 앞라인이나 딜 타입을 채우세요.",
  "선픽 팀 마지막 픽입니다. 카운터당하기 어려운 안정적인 챔피언도 좋은 선택입니다.",
  "후픽 5픽(마지막 픽) = 최종 카운터픽! 상대 다섯 챔피언을 모두 보고 라인 상대를 카운터하세요.",
];

const SETS: Record<string, string[]> = {
  teamfight: ["Orianna", "Rumble", "Gnar", "Seraphine", "MissFortune", "Azir", "Anivia", "Annie", "Cassiopeia", "Jhin", "Sion", "KSante", "Ornn", "Maokai", "Malphite", "Galio", "Neeko", "Sejuani", "Amumu", "Lissandra", "Bard", "Renata", "Jinx", "Aphelios", "Xayah", "Taliyah", "Aurora", "Kennen", "MonkeyKing", "Viktor", "Ashe", "Yunara"],
  dive: ["Vi", "JarvanIV", "XinZhao", "Camille", "Diana", "Akali", "Nocturne", "Pantheon", "Rell", "Leona", "Alistar", "Rakan", "Yone", "Qiyana", "Naafiri", "Skarner", "LeeSin", "Poppy", "Nautilus", "Ambessa", "Irelia", "Kaisa", "Hecarim", "Elise", "Locke", "Trundle", "Sylas"],
  poke: ["Jayce", "Varus", "Ezreal", "Xerath", "Ziggs", "Corki", "Zoe", "Hwei", "Lux", "Karma", "Velkoz", "Caitlyn", "Mel", "Nidalee", "Syndra", "Taliyah", "Seraphine", "Sivir"],
  split: ["Jax", "Fiora", "Camille", "Gwen", "Yorick", "Tryndamere", "Ambessa", "Trundle", "Nasus", "Gangplank", "Riven", "Irelia", "Shen", "TwistedFate", "Aatrox", "Zaahen", "Renekton", "Olaf", "Kled", "Vayne", "Quinn"],
  pick: ["Blitzcrank", "Thresh", "Nautilus", "Pyke", "Ahri", "Leblanc", "Qiyana", "Nidalee", "Elise", "Rakan", "Bard", "Lissandra", "Syndra", "TwistedFate", "Ashe", "Varus", "Akali", "Nocturne", "Pantheon", "Locke", "Naafiri", "Zoe", "Neeko", "Rell"],
  protect: ["Lulu", "Milio", "Yuumi", "Janna", "Karma", "Soraka", "Senna", "Braum", "TahmKench", "Taric", "Ivern", "Shen", "Renata", "Zilean", "Sona"],
};
const IDN: Record<string, { name: string; short: string; desc: string; win: string; weak: string }> = {
  teamfight: { name: "한타", short: "정비된 5대5 한타", desc: "광역 CC와 광역 피해로 정면 5대5에 강합니다.", win: "드래곤·바론 앞에 모여 정비된 5대5를 여세요. 진형을 유지한 채 광역 스킬을 한 번에 겹치는 것이 핵심입니다.", weak: "사이드 압박과 시간 끌기에 흔들릴 수 있습니다." },
  dive: { name: "돌진", short: "빠른 진입 교전", desc: "앞라인과 딜러를 한 번에 파고드는 진입력이 강합니다.", win: "측면 시야를 먼저 잡고 상대 주 딜러를 물어 짧고 강한 교전으로 끝내세요.", weak: "진입이 막히거나 첫 CC를 맞으면 역으로 무너질 수 있습니다." },
  poke: { name: "포킹", short: "견제 후 오브젝트 압박", desc: "긴 사거리로 싸움 전에 체력을 깎습니다.", win: "오브젝트 앞에서 시간을 쓰며 견제로 체력 우위를 만든 뒤 들어가세요. 정면 진입은 피합니다.", weak: "빠른 진입·돌진에 약하고, 앞라인이 얇으면 버티기 어렵습니다." },
  split: { name: "스플릿", short: "사이드 압박과 4인 대치", desc: "사이드 1대1·1대2 압박이 강합니다.", win: "한 명이 사이드를 밀고 나머지는 4인 대치로 시간을 버세요. 텔레포트와 합류 타이밍이 핵심입니다.", weak: "강제 5대5가 열리면 숫자 싸움에서 불리할 수 있습니다." },
  pick: { name: "픽", short: "시야 장악 후 끊어내기", desc: "시야 밖 기습과 단일 CC로 한 명씩 끊어냅니다.", win: "시야를 장악한 길목에서 한 명을 잡고, 수적 우위로 오브젝트를 가져가세요.", weak: "상대가 뭉쳐 다니면 효과가 크게 줄어듭니다." },
  protect: { name: "보호", short: "주 딜러 중심 프론트투백", desc: "보호형 서포터로 주 딜러를 지키는 프론트투백 조합입니다.", win: "주 딜러를 중심으로 진형을 유지하고 앞에서부터 차례로 싸우세요.", weak: "주 딜러가 먼저 잘리면 화력이 크게 떨어집니다." },
};
const LATE = ["Kayle", "Kassadin", "Azir", "Cassiopeia", "Aphelios", "Jinx", "KogMaw", "Zeri", "Smolder", "Vayne", "Kaisa", "Viktor", "AurelionSol", "Senna", "Veigar", "Nasus", "Ryze", "Yunara", "Orianna", "Xayah", "Gwen", "Anivia", "Vladimir", "Sivir"];
const EARLY = ["Renekton", "Draven", "Lucian", "LeeSin", "XinZhao", "Pantheon", "Elise", "Nidalee", "Kalista", "Olaf", "Qiyana", "Jayce", "Kled", "Rumble", "Rengar", "Leona", "Nautilus", "Pyke", "Blitzcrank", "Vi", "Naafiri", "Talon", "Akshan", "Corki", "Kennen"];

const CSS = `
.dl, .dl * { box-sizing: border-box; }
.dl ::-webkit-scrollbar { width: 8px; height: 8px; }
.dl ::-webkit-scrollbar-thumb { background: rgba(148,163,184,.22); border-radius: 8px; }
.dl ::-webkit-scrollbar-track { background: transparent; }
@keyframes dlGlowB { 0%,100% { box-shadow: 0 0 0 1px ${TEAM.B}, 0 0 14px ${TEAM.B}55, inset 0 0 20px ${TEAM.B}22; } 50% { box-shadow: 0 0 0 1px ${HI.B}, 0 0 32px ${TEAM.B}AA, inset 0 0 34px ${TEAM.B}44; } }
@keyframes dlGlowR { 0%,100% { box-shadow: 0 0 0 1px ${TEAM.R}, 0 0 14px ${TEAM.R}55, inset 0 0 20px ${TEAM.R}22; } 50% { box-shadow: 0 0 0 1px ${HI.R}, 0 0 32px ${TEAM.R}AA, inset 0 0 34px ${TEAM.R}44; } }
@keyframes dlShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes dlLock { 0% { opacity: 0; transform: scale(1.14); filter: brightness(2.4) saturate(1.5); } 55% { opacity: 1; } 100% { opacity: 1; transform: scale(1); filter: none; } }
@keyframes dlUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes dlBlink { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes dlSpin { to { transform: rotate(360deg); } }
@keyframes dlPop { 0% { transform: scale(.6); opacity: 0; } 70% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
.dl-ptab { transition: transform .16s ease, box-shadow .2s ease, color .2s ease; }
.dl-ptab:hover { transform: translateY(-1px); color: #E2E8F0 !important; }
.dl-sp { transform: scale(1.08); transition: transform .28s cubic-bezier(.2,.8,.2,1), filter .28s ease; }
.dl-tile:hover .dl-sq .dl-sp { transform: scale(1.2); filter: brightness(1.18) saturate(1.15); }
.dl-rec:hover .dl-sq .dl-sp { transform: scale(1.16); filter: brightness(1.15); }
.dl-meta { transition: transform .18s ease; }
.dl-meta:hover { transform: translateY(-3px); }
.dl-meta:hover .dl-sp { filter: brightness(1.18); }
.dl-tile { transition: transform .16s ease; }
.dl-tile:hover { transform: translateY(-3px); }
.dl-tile .dl-ring { transition: box-shadow .16s ease; }
.dl-tile:hover .dl-ring { box-shadow: 0 0 0 2px ${C.teal}, 0 8px 22px rgba(45,212,191,.28) !important; }
.dl-rec { transition: transform .18s ease, border-color .18s ease, background .18s ease; animation: dlUp .38s cubic-bezier(.2,.8,.2,1) both; }
.dl-rec:hover { transform: translateY(-3px); border-color: rgba(45,212,191,.55) !important; background: #132033 !important; }
.dl-btn { transition: filter .15s ease, transform .1s ease, box-shadow .2s ease; }
.dl-btn:hover:not(:disabled) { filter: brightness(1.12); }
.dl-btn:active:not(:disabled) { transform: scale(.97); }
.dl-chip { transition: background .15s ease, color .15s ease, border-color .15s ease; }
.dl-chip:hover:not(:disabled) { border-color: ${C.line2} !important; color: ${C.text} !important; }
.dl-input::placeholder { color: ${C.dim}; }
.dl-input:focus { outline: none; border-color: ${C.teal} !important; box-shadow: 0 0 0 3px rgba(45,212,191,.16); }
.dl-fade { animation: dlUp .45s cubic-bezier(.2,.8,.2,1) both; }
`;

function phaseName(i: number): string { return i < 6 ? "1차 밴" : i < 12 ? "1차 픽" : i < 16 ? "2차 밴" : "2차 픽"; }
function nameOf(id: string): string { return id === "NONE" ? "밴 없음" : BY[id] ? BY[id].name : id; }
function isFront(c: Champ): boolean { return c.u >= 3 || c.tags.includes("T"); }
function isEngage(c: Champ): boolean { return c.c >= 3 && (c.u >= 2 || c.m >= 2); }
function shr(w: number, n: number, k: number): number { return (w + k / 2) / (n + k); }
function pct(x: number): string { return `${Math.round(x * 100)}%`; }
const SMALL = 10;
let BLUE_PCT = "";
function smp(n: number): string { return n < SMALL ? " · 표본 부족" : ""; }
// n < SMALL: show raw record instead of a percentage so tiny samples (e.g. 3-0 = "100%") are not over-emphasised
function rate(w: number, n: number): string { return n < SMALL ? `${w}승 ${n - w}패 · 표본 부족` : `${pct(w / n)} (${n}경기)`; }
// Korean particle chooser: picks 을/를, 이/가, 은/는, 와/과, 으로/로 by the final consonant of the word
const JOSA: Record<string, [string, string]> = { "을": ["을", "를"], "를": ["을", "를"], "이": ["이", "가"], "가": ["이", "가"], "은": ["은", "는"], "는": ["은", "는"], "과": ["과", "와"], "와": ["과", "와"], "으로": ["으로", "로"], "로": ["으로", "로"], "이에요": ["이에요", "예요"] };
function jong(word: string): number {
  const w = word.replace(/[\s)\]}'"’”.,!?]+$/, "");
  const ch = w.charCodeAt(w.length - 1);
  if (ch >= 0xac00 && ch <= 0xd7a3) return (ch - 0xac00) % 28;
  const last = w.slice(-1);
  if (/[0-9]/.test(last)) return [21, 8, 0, 16, 0, 0, 1, 8, 8, 0][Number(last)];
  if (/[lr]/i.test(last)) return 8;
  if (/[mnbkpt]/i.test(last)) return 4;
  return 0;
}
function J(word: string, p: string): string {
  const pair = JOSA[p];
  if (!pair) return word + p;
  const j = jong(word);
  if (pair[0] === "으로") return word + (j === 0 || j === 8 ? "로" : "으로");
  return word + (j === 0 ? pair[1] : pair[0]);
}
function pres(c: Champ): number { return c.pro ? (c.pro.P + c.pro.B) / NG : 0; }
function rpres(c: Champ): number { return c.pro ? (c.pro.rp + c.pro.rb) / NR : 0; }
function champs(ids: string[]): Champ[] { const out: Champ[] = []; for (const id of ids) if (BY[id]) out.push(BY[id]); return out; }
// ---- ranked matchups (Riot API, KR solo queue, collected by us) ----
const RK_SMALL = 100;
interface Rk { wr: number; n: number }
function rk(p: Pos, a: string, b: string): Rk | null {
  const A = LP[`${PI[p]}|${a}`];
  if (A) for (const x of [...A.h, ...A.e]) if (x[0] === b) return { wr: x[1], n: x[2] };
  const B = LP[`${PI[p]}|${b}`];
  if (B) for (const x of [...B.h, ...B.e]) if (x[0] === a) return { wr: Math.round((100 - x[1]) * 100) / 100, n: x[2] };
  return null;
}
// 신뢰 기준: 30판 미만은 점수·근거·대표 상성에서 제외하고 '참고'로만 보여 줍니다.
const RK_MIN = 30;
function rkOk(r: Rk | null): Rk | null { return r && r.n >= RK_MIN ? r : null; }
function rkAdj(r: Rk): number { return ((r.wr / 100) * r.n + 0.5 * 200) / (r.n + 200); }
function rkN(n: number): string { return n.toLocaleString("ko-KR"); }
function rkTxt(name: string, r: Rk): string { return `랭크 상성 vs ${name} ${r.wr.toFixed(1)}% (${rkN(r.n)}판 · ${LP_META.tierLabel})${r.n < RK_SMALL ? " · 표본 부족" : ""}`; }
function lpLanes(id: string): Pos[] { return (LP_LANES[id] || []).map((x: [number, number | null]) => ALL_POS[x[0]]); }
function proLine(c: Champ): string { return c.pro && c.pro.P > 0 ? `승률 ${rate(c.pro.W, c.pro.P)}` : "프로 표본 없음"; }

function assign(ids: string[]): Record<string, Pos | null> {
  let best: (Pos | null)[] = ids.map(() => null);
  let bestScore = -1;
  const cur: (Pos | null)[] = [];
  const used: Pos[] = [];
  const rec = (i: number, score: number): void => {
    if (i === ids.length) { if (score > bestScore) { bestScore = score; best = [...cur]; } return; }
    const c = BY[ids[i]];
    const opts: Pos[] = c ? c.pos : [];
    opts.forEach((p: Pos, rank: number) => { if (!used.includes(p)) { used.push(p); cur.push(p); rec(i + 1, score + 10 - rank); cur.pop(); used.pop(); } });
    cur.push(null); rec(i + 1, score); cur.pop();
  };
  rec(0, 0);
  const out: Record<string, Pos | null> = {};
  ids.forEach((id: string, i: number) => { out[id] = best[i]; });
  return out;
}
function atMap(a: Record<string, Pos | null>): Partial<Record<Pos, string>> {
  const m: Partial<Record<Pos, string>> = {};
  for (const id of Object.keys(a)) { const p = a[id]; if (p) m[p] = id; }
  return m;
}
function dmgSplit(cs: Champ[]): { ad: number; ap: number } {
  let ad = 0; let ap = 0;
  for (const c of cs) { if (c.dmg === "P") ad += 1; else if (c.dmg === "M") ap += 1; else { ad += 0.5; ap += 0.5; } }
  return { ad, ap };
}

function recommend(kind: Kind, step: number, own: string[], enemy: string[], avail: Champ[], lastPick: boolean, enemyLeft: number, forcePos?: Pos): Rec[] {
  const ownAt = atMap(assign(own));
  const enAt = atMap(assign(enemy));
  const myOpen = ALL_POS.filter((p: Pos) => !ownAt[p]);
  const enOpen = ALL_POS.filter((p: Pos) => !enAt[p]);
  const ownC = champs(own);
  const { ad, ap } = dmgSplit(ownC);
  const hasFront = ownC.some(isFront);
  const hasEngage = ownC.some(isEngage);
  const hasCarry = ownC.some((c: Champ) => c.tags[0] === "K");
  const out: Rec[] = [];
  for (const c of avail) {
    const pr = c.pro;
    const pz = pres(c);
    const rz = rpres(c);
    const meta = 0.6 * rz + 0.4 * pz;
    if (kind === "pick") {
      const fits = forcePos ? (c.pos.includes(forcePos) ? [forcePos] : []) : c.pos.filter((p: Pos) => myOpen.includes(p));
      if (!fits.length) continue;
      let best: Rec | null = null;
      for (let fi = 0; fi < fits.length; fi++) {
        const p = fits[fi];
        let s = 32 * meta - (forcePos ? Math.max(0, c.pos.indexOf(p)) : fi) * 2;
        const R: Reason[] = [];
        if (meta >= 0.2 && pr) R.push({ t: `메타 핵심 — 프로 밴픽률 ${pct(pz)} (${NG}경기)`, v: 32 * meta });
        if (pr && pr.P >= 3) {
          const e = shr(pr.W, pr.P, 20) - 0.5;
          s += e * 120;
          if (pr.P >= 8 && e > 0.015) R.push({ t: `프로 승률 ${rate(pr.W, pr.P)}`, v: e * 120 + 1 });
        } else { s -= 8; R.push({ t: "프로 무대 표본 거의 없음 — 포지션은 추정", v: -1, warn: true }); }
        const eid = enAt[p];
        if (eid) {
          const lp = lastPick ? 1.5 : 1;
          const rr = rkOk(rk(p, c.id, eid));
          if (rr) {
            const e = (rkAdj(rr) - 0.5) * 160 * lp;
            s += e;
            if (e >= 0.8) R.push({ t: rkTxt(BY[eid].name, rr), v: e + (lastPick ? 8 : 4) });
            else if (e <= -1.5) R.push({ t: `주의: ${rkTxt(BY[eid].name, rr)}`, v: -1, warn: true });
          }
          const r = mu(PI[p], c.i, BY[eid].i);
          if (r) {
            const wgt = r.n >= SMALL ? 50 : rr ? 0 : 30;
            const e = (shr(r.w, r.n, 6) - 0.5) * wgt * lp;
            s += e;
            const t = `프로 맞대결 vs ${BY[eid].name} ${rate(r.w, r.n)}`;
            if (r.n >= SMALL && e >= 1) R.push({ t, v: e + 2 });
            else if (r.n >= SMALL && e <= -1.5) R.push({ t: `주의: ${t}`, v: -1, warn: true });
            else if (!rr && Math.abs(e) >= 1) R.push(e > 0 ? { t, v: 1 } : { t: `주의: ${t}`, v: -1, warn: true });
          }
        } else if (enemyLeft > 0 && pr && pr.P >= 20 && shr(pr.W, pr.P, 20) >= 0.5) {
          s += 3;
          R.push({ t: `상대 ${POS_KO[p]} 미정 — 블라인드로도 안정적 (${pr.P}경기)`, v: 3 });
        }
        for (const q of ALL_POS) {
          const oid = ownAt[q];
          if (!oid || q === p) continue;
          const r = syn(PI[p], c.i, PI[q], BY[oid].i);
          const jl = (p === "J" && (q === "M" || q === "S")) || (q === "J" && (p === "M" || p === "S"));
          if (r && r.n >= (jl ? 3 : 5)) {
            const e = (shr(r.w, r.n, 6) - 0.5) * (jl ? 90 : 60);
            s += e;
            if (e >= 1.2) R.push({ t: jl ? `${POS_KO[q]} ${J(BY[oid].name, "와")} 2:2 합 — 함께 ${rate(r.w, r.n)}` : `아군 ${J(BY[oid].name, "와")} 시너지 — 함께 ${rate(r.w, r.n)}`, v: e + (jl ? 4 : 3) });
            else if (jl && e <= -1.5) R.push({ t: `주의: ${POS_KO[q]} ${J(BY[oid].name, "와")} 함께 ${rate(r.w, r.n)}`, v: -1, warn: true });
          }
        }
        const flex = c.pos.filter((x: Pos) => myOpen.includes(x)).length;
        if (flex >= 2 && step < 12 && pr && pr.P >= 10) { s += 4; R.push({ t: `플렉스 픽 — ${c.pos.map((x: Pos) => POS_KO[x]).join("/")} 가능, 정보 은닉`, v: 4 }); }
        if (ownC.length >= 2) {
          if (ad >= ap + 2 && c.dmg !== "P") { s += 5; R.push({ t: `AP 부족 보완 (현재 AD ${ad} : AP ${ap})`, v: 5 }); }
          if (ap >= ad + 2 && c.dmg !== "M") { s += 5; R.push({ t: `AD 부족 보완 (현재 AD ${ad} : AP ${ap})`, v: 5 }); }
        }
        if (!hasFront && isFront(c)) { const v = ownC.length >= 2 ? 5 : 2; s += v; R.push({ t: "앞라인 확보 — 한타의 버팀목", v }); }
        if (!hasEngage && isEngage(c)) { const v = ownC.length >= 2 ? 4 : 2; s += v; R.push({ t: "이니시 수단 확보", v }); }
        if (hasCarry && p === "S" && c.ut >= 3) { s += 2; R.push({ t: "주 딜러 보호(필) 보강", v: 2 }); }
        if (c.gd && c.gd[0] >= 10 && c.gd[1] >= 150) { s += 2; R.push({ t: `라인전 강세 — GD@15 +${c.gd[1]} (${LG.label} ${c.gd[0]}경기)`, v: 2.5 }); }
        if ((step === 6 || step === 7) && (FP2[c.id] || 0) >= 20) { s += 3; R.push({ t: `프로 팀 첫 픽 단골 (${FP2[c.id]}회 / ${NG * 2}드래프트)`, v: 3.5 }); }
        if (p === "J") {
          const jg = JGM[c.i];
          if (jg && jg.n >= 5) {
            const r3 = (k: number): number => (k + 5) / (jg.n + 10) - 0.5;
            const early = (r3(jg.fb) + r3(jg.fd) + r3(jg.fv) + r3(jg.fh)) / 4;
            s += early * 60;
            const objs: [string, number][] = [["퍼블", jg.fb], ["첫 드래곤", jg.fd], ["유충 우세", jg.fv], ["첫 전령", jg.fh]];
            const top = objs.filter((x: [string, number]) => x[1] / jg.n >= 0.55).map((x: [string, number]) => `${x[0]} ${pct(x[1] / jg.n)}`);
            if (early > 0.015 && top.length) R.push({ t: `초반 주도권 — 팀이 ${top.join(" · ")} 선취 (정글 ${jg.n}경기)${smp(jg.n)}`, v: early * 60 + 3 });
            else if (early < -0.03) R.push({ t: `초반 오브젝트 선취 낮음 — 첫 드래곤 ${pct(jg.fd / jg.n)} · 퍼블 ${pct(jg.fb / jg.n)} (${jg.n}경기)${smp(jg.n)}`, v: -1, warn: true });
            if (jg.gn >= 5) {
              const ge = Math.max(-4, Math.min(4, jg.gd / 150));
              s += ge;
              if (jg.gd >= 100) R.push({ t: `정글 15분 성장 우위 — GD@15 +${jg.gd} · XPD@15 ${jg.xd > 0 ? "+" : ""}${jg.xd} (${LG.label} ${jg.gn}경기)`, v: ge + 2 });
            }
          } else if (jg) { R.push({ t: `정글 기용 ${jg.n}경기 — 초반 지표 표본 부족`, v: -0.5, warn: true }); }
          for (const q of ["T", "M", "A", "S"] as Pos[]) {
            const eid = enAt[q];
            if (!eid) continue;
            const r = xm(PI[q], c.i, BY[eid].i);
            if (r) {
              const e = (shr(r.w, r.n, 6) - 0.5) * 40;
              s += e;
              if (e >= 1) R.push({ t: `상대 ${POS_KO[q]} ${J(BY[eid].name, "을")} 만난 경기 승률 ${rate(r.w, r.n)} — 교차 상성 우세`, v: e + 3 });
              else if (e <= -1.5) R.push({ t: `주의: 상대 ${POS_KO[q]} ${J(BY[eid].name, "을")} 만난 경기 ${rate(r.w, r.n)}`, v: -1, warn: true });
            }
          }
        } else {
          const ej = enAt.J;
          if (ej) {
            const r = xm(PI[p], BY[ej].i, c.i);
            if (r) {
              const lw = r.n - r.w;
              const e = (shr(lw, r.n, 6) - 0.5) * 35;
              s += e;
              if (e >= 1) R.push({ t: `상대 정글 ${J(BY[ej].name, "을")} 만난 경기 승률 ${rate(lw, r.n)}`, v: e + 2 });
              else if (e <= -1.5) R.push({ t: `주의: 상대 정글 ${J(BY[ej].name, "을")} 만난 경기 ${rate(lw, r.n)} — 갱 표적 우려`, v: -1, warn: true });
            }
          }
        }
        if (!best || s > best.score) best = { id: c.id, score: s, pos: p, reasons: R };
      }
      if (best) out.push(best);
    } else {
      let s = 40 * meta;
      const R: Reason[] = [];
      if (!pr || pr.P + pr.B < 3) s -= 12;
      if (meta >= 0.15 && pr) R.push({ t: `프로 밴픽률 ${pct(pz)} · 최근 패치 ${pct(rz)} (${NG}경기)`, v: 40 * meta });
      if (step < 6) {
        if (pr && pr.b1 >= 15) { s += pr.b1 / 30; R.push({ t: `프로 1차 밴 단골 (${pr.b1}회)`, v: 2 + pr.b1 / 30 }); }
        if (step === 5 && (FP2[c.id] || 0) >= 20) { s += 3; R.push({ t: `선픽 팀 1픽 후보 차단 (프로 팀 첫 픽 ${FP2[c.id]}회)`, v: 4 }); }
      } else {
        const hit = c.pos.filter((p: Pos) => enOpen.includes(p));
        if (!hit.length) s -= 25;
        else if (enOpen.includes(c.pos[0])) { s += 8; R.push({ t: `2차 밴: 상대 남은 ${POS_KO[c.pos[0]]} 핵심 견제`, v: 9 }); }
        if (pr && pr.b2 >= 10) R.push({ t: `프로 2차 밴 ${pr.b2}회`, v: 1 + pr.b2 / 40 });
      }
      for (const q of ALL_POS) {
        const oid = ownAt[q];
        if (!oid || !c.pos.includes(q)) continue;
        const rr = rkOk(rk(q, c.id, oid));
        if (rr) {
          const e = rkAdj(rr) - 0.5;
          if (e > 0.008) { s += e * 160; R.push({ t: `아군 ${BY[oid].name} 카운터 — ${rkTxt(BY[oid].name, rr)}`, v: e * 160 + 4 }); }
          continue;
        }
        const r = mu(PI[q], c.i, BY[oid].i);
        if (r && r.n >= 3) {
          const e = shr(r.w, r.n, 6) - 0.5;
          if (e > 0.03) { s += e * 90; R.push({ t: `아군 ${BY[oid].name} 카운터 — 프로 맞대결 ${rate(r.w, r.n)}`, v: e * 90 + 4 }); }
        }
      }
      // 2차 밴: 상대가 이미 고른 챔피언과 "같이 잘 쓰이는" 챔피언을 상대의 빈 포지션에서 지우기 (교수님 요청 2026-11-12)
      // ① 대회 기록: 같이 쓰인 경기가 많고 이긴 조합일수록 높게 (승률 50% 미만 조합은 빼기)
      // ② 특성 궁합: 돌진형 서포터 + 돌진형 원딜, 같은 조합 유형(돌진·한타·포킹 등) — 대회 기록이 없을 때 보조
      const weak = !!pr && pr.P >= 8 && shr(pr.W, pr.P, 20) < 0.46; // 대회 지표가 낮은 챔피언은 궁합 가산 안 함
      let synHit = false;
      for (const q of ALL_POS) {
        const eid = enAt[q];
        if (!eid) continue;
        const ec = BY[eid];
        for (const p of c.pos) {
          if (p === q || !enOpen.includes(p)) continue;
          const r = syn(PI[p], c.i, PI[q], ec.i);
          // 대회 동반 기록은 "그 조합의 승률"로 판단 (챔피언 전체 승률이 낮아도 그 조합이 이겼으면 포함)
          if (r && r.n >= 3 && shr(r.w, r.n, 6) >= 0.5) {
            // 바텀 2:2(원딜·서폿)가 가장 단단한 조합, 정글-미드·정글-서폿 다음, 나머지는 약하게
            const pw = (p === "A" && q === "S") || (p === "S" && q === "A") ? 1 : (p === "J" || q === "J") && (p === "M" || q === "M" || p === "S" || q === "S") ? 0.8 : 0.6;
            const e = (Math.min(r.n, 15) * 1.3 + (shr(r.w, r.n, 6) - 0.5) * 80) * pw;
            s += e; synHit = true;
            R.push({ t: `상대 ${POS_KO[q]} ${J(ec.name, "와")} 대회에서 ${r.n}경기 함께 (${r.w}승 ${r.n - r.w}패) — 이 조합 차단`, v: e + 6 });
            break;
          }
          if (weak) continue;
          // 특성 궁합 (대회 기록이 없거나 적을 때)
          let tr = "";
          if (q === "S" && p === "A" && isEngage(ec) && c.tags[0] === "K" && c.m >= 3) tr = `${J(ec.name, "이")} 먼저 들어가면 바로 따라 들어가는 돌진형 원딜`;
          else if (q === "A" && p === "S" && c.m <= 3 && isEngage(c) && ec.m >= 3) tr = `돌진형 원딜 ${J(ec.name, "와")} 같이 들어가는 이니시 서포터`;
          else if (q === "S" && p === "A" && ec.ut >= 3 && LATE.includes(c.id)) tr = `보호형 서포터 ${J(ec.name, "와")} 맞는 후반 원딜`;
          else {
            const g = Object.keys(SETS).find((k: string) => SETS[k].includes(ec.id) && SETS[k].includes(c.id));
            if (g) tr = `상대 ${J(ec.name, "와")} 같은 ${IDN[g].name} 조합 유형`;
          }
          if (tr) {
            const duo = (q === "S" && p === "A") || (q === "A" && p === "S");
            const v = duo ? 14 : (pr && pr.P >= 5) ? 6 : 4;
            s += v; synHit = true;
            R.push({ t: `${tr} — 상대 ${POS_KO[p]} 후보 (특성 기준)`, v: v + 2 });
            break;
          }
        }
      }
      // 대회 표본이 없어도 상대 조합과 궁합이 뚜렷하면 2차 밴 후보로 올려 줌 (예: 사미라)
      if (synHit && step >= 12 && (!pr || pr.P + pr.B < 3)) s += 10;
      if (c.pos.length >= 2 && pr && pr.P >= 10) { s += 2; R.push({ t: `플렉스 — 상대가 ${c.pos.map((x: Pos) => POS_KO[x]).join("/")} 어디든 기용 가능`, v: 1.5 }); }
      out.push({ id: c.id, score: s, pos: null, reasons: R });
    }
  }
  out.sort((a: Rec, b: Rec) => b.score - a.score);
  return out;
}
function topReasons(r: Rec, k?: number): Reason[] {
  const good = r.reasons.filter((x: Reason) => !x.warn).sort((a: Reason, b: Reason) => b.v - a.v).slice(0, k ?? (r.pos === "J" ? 3 : 2));
  const warn = r.reasons.filter((x: Reason) => !!x.warn).slice(0, 1);
  return [...good, ...warn];
}
function aiPick(recs: Rec[], diff: Diff): Rec | null {
  if (!recs.length) return null;
  if (diff === "pro") return recs.length > 1 && recs[0].score - recs[1].score < 1.5 && Math.random() < 0.35 ? recs[1] : recs[0];
  if (diff === "easy" && Math.random() < 0.25) return recs[Math.floor(Math.random() * Math.min(recs.length, 30))];
  const pool = recs.slice(0, diff === "normal" ? 4 : 12);
  const base = pool[pool.length - 1].score;
  const ws = pool.map((r: Rec) => r.score - base + 1.5);
  let x = Math.random() * ws.reduce((a: number, b: number) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { x -= ws[i]; if (x <= 0) return pool[i]; }
  return pool[0];
}
function identity(ids: string[]): { k: string; v: number }[] {
  const sc: Record<string, number> = { teamfight: 0, dive: 0, poke: 0, split: 0, pick: 0, protect: 0 };
  for (const id of ids) {
    const c = BY[id];
    if (!c) continue;
    for (const k of Object.keys(SETS)) if (SETS[k].includes(id)) sc[k] += k === "pick" ? 1.5 : 2;
    if (c.c >= 3) sc.teamfight += 0.7;
    if (c.m >= 3 && !c.ranged && (c.tags.includes("F") || c.tags.includes("A"))) sc.dive += 0.7;
  }
  return Object.keys(sc).map((k: string) => ({ k, v: sc[k] })).sort((a: { k: string; v: number }, b: { k: string; v: number }) => b.v - a.v);
}

let META_TOP: Champ[] = [];

// Position meta tiers: presence at the position (bans split by position share, recent patches weighted 60%) + shrunk position win rate
interface TierItem { c: Champ; tier: string; n: number; wr: number; score: number }
let TIER: Record<string, TierItem[]> = {};
const TIER_C: Record<string, string> = { S: "#F5B83D", A: "#2DD4BF", B: "#3B82F6", C: "#64748B", "—": "#273449" };
function buildTier(): void {
  TIER = {};
  for (const p of ALL_POS) {
    const items: TierItem[] = [];
    for (const c of CH) {
      if (!c.pro || !c.pro.P) continue;
      const np = c.pro.pos[PI[p]];
      if (!np) continue;
      const sh = np / c.pro.P;
      const pp = (np + c.pro.B * sh) / NG;
      const rp = ((c.pro.rp + c.pro.rb) * sh) / NR;
      const w = POSW[c.i] ? POSW[c.i][PI[p]] : 0;
      items.push({ c, tier: "", n: np, wr: w / np, score: 100 * (0.6 * rp + 0.4 * pp) + 150 * ((w + 10) / (np + 20) - 0.5) });
    }
    items.sort((a: TierItem, b: TierItem) => b.score - a.score);
    const ok = items.filter((x: TierItem) => x.n >= 5);
    ok.forEach((x: TierItem, k: number) => { const q = k / ok.length; x.tier = q < 0.1 || k < 2 ? "S" : q < 0.3 ? "A" : q < 0.6 ? "B" : "C"; });
    items.forEach((x: TierItem) => { if (x.n < 5) x.tier = "—"; });
    TIER[p] = items;
  }
}
// ---------- 리그 데이터 바꿔 끼우기 ----------
let LG_KEY = "";
let LG: ProLeague = PRO.LCK;
const LEAGUE_KEYS: string[] = ["ALL", "LCK", "LPL", "LEC", "LCS", "INTL"].filter((k: string) => !!PRO[k]);
function applyLeague(key: string): void {
  if (key === LG_KEY || !PRO[key]) return;
  LG_KEY = key; LG = PRO[key];
  NG = LG.ng; NR = LG.nr; BLUE_W = LG.blueW;
  BLUE_PCT = `${((BLUE_W / Math.max(1, NG)) * 100).toFixed(1)}%`;
  for (const c of CH) { c.pro = null; c.gd = null; }
  for (const s of LG.pro ? LG.pro.split(";") : []) {
    const [head, g] = s.split("|"); const [ix, nums] = head.split(":"); const v = nums.split(",").map(Number); const c = CH[Number(ix)];
    if (!c) continue;
    c.pro = { P: v[0], W: v[1], B: v[2], pos: v.slice(3, 8), fp: v[8], b1: v[9], b2: v[10], rp: v[11], rb: v[12] };
    if (g) { const gv = g.split(",").map(Number); c.gd = [gv[0], gv[1]]; }
  }
  MUM.clear(); for (const s of LG.mud ? LG.mud.split(";") : []) { const v = s.split(",").map(Number); MUM.set(`${v[0]}|${v[1]}|${v[2]}`, [v[3], v[4]]); }
  SYM.clear(); for (const s of LG.syd ? LG.syd.split(";") : []) { const f = s.split(","); SYM.set(`${f[0]}|${f[1]}|${f[2]}`, [Number(f[3]), Number(f[4])]); }
  for (const k of Object.keys(POSW)) delete POSW[Number(k)];
  for (const s of LG.pwd ? LG.pwd.split(";") : []) { const v = s.split(",").map(Number); POSW[v[0]] = v.slice(1); }
  for (const k of Object.keys(JGM)) delete JGM[Number(k)];
  for (const s of LG.jgd ? LG.jgd.split(";") : []) { const f = s.split(","); const v = f.map(Number); JGM[v[0]] = { n: v[1], fb: v[2], fd: v[3], fh: v[4], fv: v[5], gn: v[6] || 0, gd: f[7] ? v[7] : 0, xd: f[8] ? v[8] : 0 }; }
  XMM.clear(); for (const s of LG.xmd ? LG.xmd.split(";") : []) { const v = s.split(",").map(Number); XMM.set(`${v[0]}|${v[1]}|${v[2]}`, [v[3], v[4]]); }
  FP2 = {}; for (const s of LG.fpd ? LG.fpd.split(";") : []) { const f = s.split(","); FP2[f[0]] = Number(f[1]); }
  META_TOP = [...CH].sort((a: Champ, b: Champ) => pres(b) - pres(a)).slice(0, 12);
  buildTier();
}
applyLeague("LCK");
function tierOf(p: string, id: string): string { const x = TIER[p] ? TIER[p].find((y: TierItem) => y.c.id === id) : undefined; return x && x.tier !== "—" ? x.tier : ""; }

const IMG = "./champ";
function Art(props: { id: string; kind: "splash" | "square" | "loading"; size?: number; fill?: boolean; radius?: number; pos?: string; align?: "left" | "right" | "center"; sizes?: string; eager?: boolean }) {
  const c = BY[props.id];
  if (props.kind === "square") {
    const s = props.size ?? 48;
    const r = props.radius ?? 8;
    const dim: CSSProperties = props.fill ? { position: "absolute", inset: 0 } : { position: "relative", width: s, height: s };
    return (
      <div className="dl-sq" style={{ ...dim, borderRadius: r, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg, #1C2840, #0D1420)", display: "flex", alignItems: "center", justifyContent: "center", color: C.sub, fontWeight: 800, fontSize: Math.round(s * 0.36) }}>
        <span>{c ? c.name[0] : "?"}</span>
        {c ? <img className="dl-sp" src={`${IMG}/icon/${c.id}.webp`} alt={c.name} loading={props.eager ? "eager" : "lazy"} decoding="async" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        <div style={{ position: "absolute", inset: 0, borderRadius: r, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.10), inset 0 -12px 16px -8px rgba(0,0,0,.45)", pointerEvents: "none" }} />
      </div>
    );
  }
  if (!c) return null;
  if (props.kind === "loading") {
    return <img className="dl-art" src={`${IMG}/loading/${c.id}.webp`} alt={c.name} loading="lazy" decoding="async" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: props.pos ?? "50% 16%" }} />;
  }
  const al = props.align ?? "center";
  const mask = al === "right" ? "linear-gradient(to left, #000 55%, transparent 100%)" : al === "left" ? "linear-gradient(to right, #000 55%, transparent 100%)" : "none";
  const op = props.pos ?? (al === "left" ? "35% 24%" : al === "right" ? "65% 24%" : "50% 24%");
  return (
    <img className="dl-art" src={`${IMG}/splash-sm/${c.id}.webp`} srcSet={`${IMG}/splash-sm/${c.id}.webp 640w, ${IMG}/splash/${c.id}.webp 1215w`} sizes={props.sizes ?? "(min-width: 1600px) 480px, 360px"} alt={c.name} loading="lazy" decoding="async" draggable={false}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: op, WebkitMaskImage: mask, maskImage: mask }} />
  );
}

function PosIcon(props: { p: Pos; size?: number; color?: string }) {
  const s = props.size ?? 14;
  const col = props.color ?? "currentColor";
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill={col} style={{ display: "block", flexShrink: 0 }}>
      {props.p === "T" ? <Fragment><path d="M2 2h10l-3 3H5v4l-3 3z" /><rect x="8" y="8" width="6" height="6" rx="1" opacity="0.4" /></Fragment> : null}
      {props.p === "J" ? <Fragment><path d="M8 1.5c.6 2.4 3.6 3.6 3.6 7.1A3.6 3.6 0 0 1 8 12.2a3.6 3.6 0 0 1-3.6-3.6C4.4 5.1 7.4 3.9 8 1.5z" /><rect x="7.2" y="12" width="1.6" height="2.6" /></Fragment> : null}
      {props.p === "M" ? <Fragment><path d="M2 12.5 12.5 2H14v1.5L3.5 14H2z" /><rect x="2" y="2" width="4" height="4" rx="1" opacity="0.4" /><rect x="10" y="10" width="4" height="4" rx="1" opacity="0.4" /></Fragment> : null}
      {props.p === "A" ? <Fragment><path d="M14 14H4l3-3h4V7l3-3z" /><rect x="2" y="2" width="6" height="6" rx="1" opacity="0.4" /></Fragment> : null}
      {props.p === "S" ? <path d="M8 1.5 13.5 4v4c0 3.4-2.4 5.4-5.5 6.5C4.9 13.4 2.5 11.4 2.5 8V4z" /> : null}
    </svg>
  );
}

function SiteFooter() {
  return (
    <footer className="foot">
      <div className="shell">
        <div>
          <h3>데이터 출처</h3>
          <p><b>프로 경기</b>: Oracle's Elixir 2026 경기 표(oracleselixir.com, 하루 1회 갱신)를 리그별로 집계 · 경기 통계는 Riot Games 소유 · 선수 이름은 쓰지 않음.</p>
          <p><b>{LG.desc} {NG}경기</b> ({LG.from} ~ {LG.to}) · 패치 {LG.patches} · 최근 6패치 {LG.recent} {NR}경기 · 집계일 {PRO_MADE}.</p>
          <p>GD·XPD@15(15분 골드·경험치 차이)는 Oracle's Elixir 지표를 챔피언별로 평균했습니다. 챔피언 특성: Community Dragon · 이미지: Data Dragon {PATCH}(사이트 내 자체 호스팅).</p>
          <p><b>랭크 상성</b>: Riot Games API(MATCH-V5)로 직접 모은 한국 서버 솔로 랭크 {rkN(LP_META.games)}경기 · 티어 {tierTxt(LP_META)} · 패치 {LP_META.patch} · 수집일 {LP_META.collectedAt}. 맞대결 판수가 적으면 '표본 부족'으로 표시합니다.</p>
          <p>표본이 10경기 미만인 수치는 승률 대신 'n승 m패'와 '표본 부족'으로 표시하며, 데이터에 없는 지표는 만들지 않고 '—'로 둡니다.</p>
        </div>
        <div>
          <h3>법적 고지</h3>
          <p>LoL 밴픽대전 시뮬레이터는 Riot Games의 보증을 받지 않았으며, Riot Games 또는 Riot Games 자산의 제작·관리에 공식적으로 관여하는 사람의 견해나 의견을 반영하지 않습니다. Riot Games 및 관련된 모든 자산은 Riot Games, Inc.의 상표 또는 등록 상표입니다.</p>
          <p lang="en">LoL Ban/Pick Simulator isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
          <p>교육용 비상업 프로젝트 · 신구대학교 e스포츠과 · 폰트 Pretendard(SIL OFL)</p>
          <p className="foot-links"><a href="./terms.html">이용약관 (Terms of Service)</a> · <a href="./privacy.html">개인정보 처리방침 (Privacy Policy)</a></p>
        </div>
      </div>
    </footer>
  );
}

function pref(k: string, d: boolean): boolean {
  try { const v = localStorage.getItem("bp." + k); return v === null ? d : v === "1"; } catch { return d; }
}
function savePref(k: string, v: boolean): void { try { localStorage.setItem("bp." + k, v ? "1" : "0"); } catch { /* 저장 못 해도 동작 */ } }

// 효과음: 파일 없이 브라우저에서 바로 합성 (픽 = 올라가는 두 음 + 바람 소리, 밴 = 낮은 쿵)
let AC: AudioContext | null = null;
function sfx(kind: Kind): void {
  try {
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = W.AudioContext || W.webkitAudioContext;
    if (!Ctor) return;
    if (!AC) AC = new Ctor();
    const ac = AC;
    if (ac.state === "suspended") void ac.resume();
    const t0 = ac.currentTime;
    const out = ac.createGain();
    out.gain.value = 0.16;
    out.connect(ac.destination);
    const tone = (f0: number, f1: number, at: number, dur: number, type: OscillatorType, vol: number) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t0 + at);
      o.frequency.exponentialRampToValueAtTime(f1, t0 + at + dur);
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g); g.connect(out);
      o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
    };
    const noise = (at: number, dur: number, from: number, to: number, vol: number) => {
      const n = Math.floor(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, n, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = ac.createBufferSource();
      s.buffer = buf;
      const f = ac.createBiquadFilter();
      f.type = "bandpass"; f.Q.value = 0.8;
      f.frequency.setValueAtTime(from, t0 + at);
      f.frequency.exponentialRampToValueAtTime(to, t0 + at + dur);
      const g = ac.createGain();
      g.gain.value = vol;
      s.connect(f); f.connect(g); g.connect(out);
      s.start(t0 + at);
    };
    if (kind === "pick") {
      noise(0, 0.45, 600, 3200, 0.9);
      tone(440, 660, 0.05, 0.22, "triangle", 0.5);
      tone(660, 990, 0.2, 0.5, "triangle", 0.45);
      tone(1320, 1320, 0.2, 0.6, "sine", 0.12);
    } else {
      tone(180, 60, 0, 0.35, "sine", 0.9);
      noise(0, 0.18, 1800, 300, 0.6);
    }
  } catch { /* 소리가 안 나도 밴픽은 그대로 */ }
}

// 초보 도움말: 지금 단계가 무엇인지 쉬운 말로
function learnText(step: number, kind: Kind): string {
  if (kind === "ban") return step < 6
    ? "밴은 '이번 판에 아무도 못 쓰게 지우는 것'이에요. 상대가 쓰면 곤란한 강한 챔피언을 하나 고르세요."
    : "2차 밴이에요. 상대 팀에 아직 비어 있는 포지션을 보고, 그 자리에 들어올 만한 챔피언을 지우면 좋아요.";
  return step < 12
    ? "픽은 '우리 팀이 쓸 챔피언을 고르는 것'이에요. 탑·정글·미드·원딜·서폿 다섯 자리를 하나씩 채운다고 생각하세요."
    : "2차 픽이에요. 우리 팀에 빈 포지션과 부족한 역할(앞에서 버티는 챔피언, 마법 피해 등)을 채우세요.";
}

export default function App() {
  const t = useGrokTheme();
  const [stage, setStage] = useState<"setup" | "draft">("setup");
  const [mode, setMode] = useState<"pvp" | "ai">("pvp");
  const [diff, setDiff] = useState<Diff>("normal");
  const [nameA, setNameA] = useState<string>("1팀");
  const [nameB, setNameB] = useState<string>("2팀");
  // 2026 First Selection: the holder picks either map side or draft order, the other team picks the remaining one
  const [blueTeam, setBlueTeam] = useState<TeamKey | null>(null);
  const [firstTeam, setFirstTeam] = useState<TeamKey | null>(null);
  const [selTeam, setSelTeam] = useState<TeamKey | null>(null);
  const [selWhat, setSelWhat] = useState<"side" | "order" | null>(null);
  const [aiNote, setAiNote] = useState<string>("");
  const [winners, setWinners] = useState<Record<number, TeamKey>>({});
  const [fear5Off, setFear5Off] = useState<boolean>(false);
  const [coinMsg, setCoinMsg] = useState<string>("");
  const [timerSec, setTimerSec] = useState<string>("30");
  const [fearless, setFearless] = useState<boolean>(true);
  const [proMode, setProMode] = useState<boolean>(false);
  const [quick, setQuick] = useState<boolean>(false);
  const [acts, setActs] = useState<Act[]>([]);
  const [history, setHistory] = useState<SetRecord[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [q, setQ] = useState<string>("");
  const [posF, setPosF] = useState<string>("ALL");
  const [ptab, setPtab] = useState<string>("ALL");
  const [vsLane, setVsLane] = useState<Pos | null>(null);
  // 상성 탭에 고정할 챔피언: 클릭한 챔피언만 바뀌고, 마우스를 올리는 것만으로는 바뀌지 않습니다.
  const [vsPin, setVsPinRaw] = useState<string | null>(null);
  const setVsPin = (id: string | null): void => { if (id !== vsPin) setVsLane(null); setVsPinRaw(id); };
  // 프로 데이터 리그 (교수님 요청 2026-11-13): 브라우저에 기억
  const [league, setLeagueRaw] = useState<string>(() => { try { const v = localStorage.getItem("bp.league"); return v && PRO[v] ? v : "LCK"; } catch { return "LCK"; } });
  const setLeague = (k: string): void => { setLeagueRaw(k); try { localStorage.setItem("bp.league", k); } catch { /* 저장 못 해도 동작 */ } };
  applyLeague(league);
  const [rkTier, setRkTierState] = useState<number>(RK_DEFAULT);
  const [showLow, setShowLow] = useState<boolean>(false);
  setRkTier(rkTier);
  const [sortMeta, setSortMeta] = useState<boolean>(false);
  const [paused, setPaused] = useState<boolean>(false);
  const [clock, setClock] = useState<{ step: number; left: number }>({ step: -1, left: 0 });
  const [showResult, setShowResult] = useState<boolean>(false);
  // 연출·보기 설정 (브라우저에 기억, 실패해도 기본값으로 동작)
  const [fx, setFx] = useState<boolean>(() => pref("fx", true));
  const [big, setBig] = useState<boolean>(() => pref("big", false));
  const [learn, setLearn] = useState<boolean>(() => pref("learn", true));
  useEffect(() => { savePref("fx", fx); savePref("big", big); savePref("learn", learn); }, [fx, big, learn]);

  const bName = mode === "ai" ? "AI" : nameB;
  const keyName = (k: TeamKey): string => (k === "A" ? nameA || "1팀" : bName || "2팀");
  const otherKey = (k: TeamKey): TeamKey => (k === "A" ? "B" : "A");
  const step = acts.length;
  const done = step >= 20;
  const drafting = stage === "draft";
  const cur: Step | null = !drafting || done ? null : STEPS[step];
  const bT: TeamKey = blueTeam ?? "A";
  const fT: TeamKey = firstTeam ?? "A";
  const ready = blueTeam !== null && firstTeam !== null;
  const keyOf = (o: Ord): TeamKey => (o === "F" ? fT : otherKey(fT));
  const colorOf = (o: Ord): Side => (keyOf(o) === bT ? "B" : "R");
  const ordAt = (s: Side): Ord => ((s === "B" ? bT : otherKey(bT)) === fT ? "F" : "L");
  const teamName = (o: Ord): string => keyName(keyOf(o));
  const isAISide = (o: Ord): boolean => mode === "ai" && keyOf(o) === "B";
  const lbl = (o: Ord): string => `${ORD_KO[o]} · ${SIDE_KO[colorOf(o)]}`;
  const sLbl = (sd: Side): string => `${ORD_KO[ordAt(sd)]} · ${SIDE_KO[sd]}`;
  const setNo = history.length + 1;
  const score: Record<TeamKey, number> = { A: 0, B: 0 };
  for (const k of Object.keys(winners)) score[winners[Number(k)]] += 1;

  const ids = (o: Ord, k: Kind): string[] => { const out: string[] = []; acts.forEach((a: Act, i: number) => { if (STEPS[i].side === o && STEPS[i].kind === k) out.push(a.id); }); return out; };
  const picksF = ids("F", "pick"); const picksL = ids("L", "pick");
  const bansF = ids("F", "ban"); const bansL = ids("L", "ban");
  const picksB = ordAt("B") === "F" ? picksF : picksL; const picksR = ordAt("B") === "F" ? picksL : picksF;

  const fearLocked: string[] = [];
  const banCount: Record<string, number> = {};
  for (const h of history) h.acts.forEach((a: Act, i: number) => { if (STEPS[i].kind === "pick") fearLocked.push(a.id); else if (a.id !== "NONE") banCount[a.id] = (banCount[a.id] || 0) + 1; });
  const usedNow = acts.map((a: Act) => a.id);
  const status = (id: string): string => {
    if (usedNow.includes(id)) return "used";
    if (fearless && !(fear5Off && setNo === 5) && fearLocked.includes(id)) return "fearless";
    if (proMode && (banCount[id] || 0) >= 2) return "perma";
    return "free";
  };
  const avail = CH.filter((c: Champ) => status(c.id) === "free");

  let recs: Rec[] = [];
  if (cur) {
    const own = cur.side === "F" ? picksF : picksL;
    const en = cur.side === "F" ? picksL : picksF;
    const lastPick = cur.kind === "pick" && cur.n === 5;
    let enemyLeft = 0;
    for (let i = step + 1; i < 20; i++) if (STEPS[i].side !== cur.side && STEPS[i].kind === "pick") enemyLeft++;
    recs = recommend(cur.kind, step, own, en, avail, lastPick, enemyLeft);
  }
  const top5 = recs.slice(0, 6);
  const topIds = top5.map((r: Rec) => r.id);
  const offWhy = (id: string): string => {
    const st = status(id);
    if (st === "fearless") return "피어리스";
    if (st === "perma") return "영구 밴";
    if (st === "used") { const k = acts.findIndex((a: Act) => a.id === id); return k >= 0 && STEPS[k].kind === "ban" ? "밴됨" : "픽됨"; }
    return "";
  };
  let posRecs: Rec[] = [];
  let ownFilled: string | undefined;
  if (cur && ptab !== "ALL" && ptab !== "VS") {
    const own = cur.side === "F" ? picksF : picksL;
    const en = cur.side === "F" ? picksL : picksF;
    let el = 0;
    for (let i = step + 1; i < 20; i++) if (STEPS[i].side !== cur.side && STEPS[i].kind === "pick") el++;
    posRecs = recommend("pick", step, own, en, avail, cur.kind === "pick" && cur.n === 5, el, ptab as Pos).slice(0, 6);
    ownFilled = atMap(assign(own))[ptab as Pos];
  }

  const act = (a: Act): void => { setActs((prev: Act[]) => (prev.length >= 20 ? prev : [...prev, a])); setSel(null); setHover(null); };
  const humanTurn = drafting && !!cur && !isAISide(cur.side);
  const confirm = (id: string | null): void => { if (humanTurn && id && status(id) === "free") act({ id, by: "human" }); };
  const choose = (id: string): void => { if (!humanTurn || status(id) !== "free") return; if (quick) confirm(id); else setSel(id); };

  useEffect(() => {
    if (!drafting || !cur || !isAISide(cur.side)) return;
    const h = setTimeout(() => {
      const r = aiPick(recs, diff);
      act({ id: r ? r.id : "NONE", by: "ai", reason: r ? topReasons(r).filter((x: Reason) => !x.warn).map((x: Reason) => x.t).join(" · ") || "메타·조합 종합 점수" : "후보 없음" });
    }, 1100);
    return () => clearTimeout(h);
  }, [stage, step, mode, blueTeam, firstTeam]);

  const N = Number(timerSec);
  useEffect(() => {
    if (!drafting || !cur || N === 0 || isAISide(cur.side)) return;
    if (clock.step !== step) { setClock({ step, left: N }); return; }
    if (paused) return;
    if (clock.left <= 0) {
      if (cur.kind === "ban") act({ id: "NONE", by: "timeout", reason: "시간 초과로 밴 없음" });
      else if (sel && status(sel) === "free") act({ id: sel, by: "timeout", reason: "시간 초과 — 선택 중이던 챔피언 자동 확정" });
      else if (recs.length) act({ id: recs[0].id, by: "timeout", reason: "시간 초과 — 추천 1순위 자동 확정" });
      return;
    }
    const h = setTimeout(() => setClock((c: { step: number; left: number }) => ({ step: c.step, left: c.left - 1 })), 1000);
    return () => clearTimeout(h);
  }, [clock, paused, stage, step, timerSec, mode, blueTeam, firstTeam]);
  const left = clock.step === step ? clock.left : N;

  // 픽·밴 확정 효과음 (큰 그림 연출은 교수님 의견으로 뺌, 2026-11-12)
  useEffect(() => {
    if (!drafting || !acts.length || !fx) return;
    const i = acts.length - 1;
    if (acts[i].id !== "NONE") sfx(STEPS[i].kind);
  }, [acts.length, stage]);

  // ---------- First Selection ----------
  const blueWhy = `프로 ${NG}경기(2026, 첫 번째 선택권 시행 이후)에서 블루 진영 승률이 ${BLUE_PCT}(${BLUE_W}승 ${NG - BLUE_W}패)라 블루 진영을 골랐습니다.`;
  const aiOrder = (): { o: Ord; why: string } => {
    const top = CH.filter((c: Champ) => status(c.id) === "free").sort((a: Champ, b: Champ) => pres(b) - pres(a))[0];
    const tp = top ? pres(top) : 0;
    if (top && tp >= 0.6) return { o: "F", why: `남은 챔피언 중 ${J(top.name, "을")} 1픽으로 확보하려고 선픽을 골랐습니다(프로 밴픽률 ${pct(tp)}, ${NG}경기).` };
    return { o: "L", why: `남은 챔피언 중 밴픽률 최고가 ${top ? `${top.name} ${pct(tp)}` : "—"}로 압도적인 1픽이 없어, 마지막 카운터픽을 위해 후픽을 골랐습니다.` };
  };
  const decide = (who: TeamKey, what: "side" | "order", val: string): void => {
    if (what === "side") setBlueTeam(val === "B" ? who : otherKey(who));
    else setFirstTeam(val === "F" ? who : otherKey(who));
  };
  const giveSel = (k: TeamKey, msg: string): void => {
    setSelTeam(k); setSelWhat(null); setBlueTeam(null); setFirstTeam(null); setCoinMsg(msg); setAiNote("");
    if (mode === "ai" && k === "B") { setSelWhat("side"); setBlueTeam("B"); setAiNote(`AI는 진영을 골랐습니다. ${blueWhy} 이제 ${J(keyName("A"), "이")} 밴픽 순서를 고릅니다.`); }
  };
  const holderPick = (what: "side" | "order", val: string): void => {
    if (!selTeam) return;
    setSelWhat(what);
    if (what === "side") setFirstTeam(null); else setBlueTeam(null);
    decide(selTeam, what, val);
    setAiNote("");
    if (mode === "ai" && selTeam === "A") {
      if (what === "side") { const r = aiOrder(); decide("B", "order", r.o); setAiNote(`AI는 ${r.o === "F" ? "선픽" : "후픽"}을 골랐습니다. ${r.why}`); }
      else { decide("B", "side", "B"); setAiNote(`AI는 블루 진영을 골랐습니다. ${blueWhy}`); }
    }
  };
  const otherPick = (what: "side" | "order", val: string): void => { if (selTeam) decide(otherKey(selTeam), what, val); };
  const recordWin = (k: TeamKey): void => {
    setWinners((w: Record<number, TeamKey>) => ({ ...w, [setNo - 1]: k }));
    giveSel(otherKey(k), `규칙: 이전 세트에서 진 ${J(keyName(otherKey(k)), "이")} 첫 번째 선택권을 갖습니다.`);
  };
  const changeMode = (m: "pvp" | "ai"): void => { if (m === mode) return; setMode(m); setSelTeam(null); setSelWhat(null); setBlueTeam(null); setFirstTeam(null); setCoinMsg(""); setAiNote(""); };
  // "처음이에요": 학생 vs AI(쉬움), 시간 무제한, 도움말 켜기. 학생 팀이 블루 진영, AI가 순서를 고르고 바로 시작
  const easyStart = (): void => {
    setMode("ai"); setDiff("easy"); setTimerSec("0"); setQuick(false); setLearn(true);
    setSelTeam("A"); setSelWhat("side"); setBlueTeam("A");
    const r = aiOrder();
    setFirstTeam(r.o === "F" ? "B" : "A");
    setCoinMsg(""); setAiNote(`AI는 ${r.o === "F" ? "선픽" : "후픽"}을 골랐습니다. ${r.why}`);
    setActs([]); setSel(null); setHover(null); setPaused(false); setShowResult(false); setClock({ step: -1, left: 0 }); setStage("draft"); window.scrollTo({ top: 0 });
  };
  const startSet = (): void => { setActs([]); setSel(null); setHover(null); setPaused(false); setShowResult(false); setClock({ step: -1, left: 0 }); setStage("draft"); window.scrollTo({ top: 0 }); };
  const undo = (): void => {
    const a = [...acts];
    while (a.length) { const i = a.length - 1; a.pop(); if (!isAISide(STEPS[i].side)) break; }
    setActs(a); setSel(null); setShowResult(false); setClock({ step: -1, left: 0 });
  };
  const resetSet = (): void => { setActs([]); setSel(null); setShowResult(false); setClock({ step: -1, left: 0 }); };
  const nextSet = (): void => {
    if (setNo >= 5) return;
    setHistory((h: SetRecord[]) => [...h, { no: h.length + 1, blueName: keyName(bT), redName: keyName(otherKey(bT)), blueKey: bT, firstSide: colorOf("F"), acts }]);
    setActs([]); setSel(null); setShowResult(false); setSelTeam(null); setSelWhat(null); setBlueTeam(null); setFirstTeam(null); setCoinMsg(""); setAiNote(""); setStage("setup"); window.scrollTo({ top: 0 });
    const w = winners[setNo];
    if (w) giveSel(otherKey(w), `규칙: SET ${setNo}에서 진 ${J(keyName(otherKey(w)), "이")} 첫 번째 선택권을 갖습니다.`);
  };
  const markWin = (k: TeamKey): void => setWinners((w: Record<number, TeamKey>) => ({ ...w, [setNo]: k }));
  const resetAll = (): void => { setHistory([]); setWinners({}); setActs([]); setSel(null); setShowResult(false); setSelTeam(null); setSelWhat(null); setBlueTeam(null); setFirstTeam(null); setCoinMsg(""); setAiNote(""); setStage("setup"); };

  const ql = q.trim().toLowerCase();
  let shown = CH.filter((c: Champ) => (posF === "ALL" || c.pos.includes(posF as Pos)) && (!ql || c.name.includes(q.trim()) || c.id.toLowerCase().includes(ql)));
  if (sortMeta) shown = [...shown].sort((a: Champ, b: Champ) => pres(b) - pres(a));

  let guide = "";
  let guideExtra = "";
  if (cur) {
    guide = HINTS[step];
    const own = cur.side === "F" ? picksF : picksL;
    const en = cur.side === "F" ? picksL : picksF;
    if (cur.kind === "pick" && own.length) {
      const oa = atMap(assign(own));
      const d = dmgSplit(champs(own));
      guideExtra = `비어 있는 포지션: ${ALL_POS.filter((p: Pos) => !oa[p]).map((p: Pos) => POS_KO[p]).join(" · ") || "없음"}   |   딜 구성 AD ${d.ad} : AP ${d.ap}${champs(own).some(isFront) ? "" : "   |   앞라인 없음"}`;
    } else if (cur.kind === "ban" && step >= 12) {
      const ea = atMap(assign(en));
      guideExtra = `상대가 아직 채우지 않은 포지션: ${ALL_POS.filter((p: Pos) => !ea[p]).map((p: Pos) => POS_KO[p]).join(" · ")}`;
    }
  }

  // ---------- small UI helpers ----------
  const cvar = (c: string): CSSProperties => ({ ["--c" as string]: c } as CSSProperties);
  const chip = (text: string, on: boolean, onClick: () => void, opts?: { color?: string; disabled?: boolean; icon?: Pos; title?: string }) => (
    <button key={text} className={"ui-chip" + (on ? " on" : "")} disabled={opts?.disabled} onClick={onClick} title={opts?.title} style={opts?.color ? cvar(opts.color) : undefined}>
      {opts?.icon ? <PosIcon p={opts.icon} size={14} /> : null}{text}
    </button>
  );
  const sw = (text: string, value: boolean, onChange: (v: boolean) => void, disabled?: boolean) => (
    <button key={text} className={"ui-sw" + (value ? " on" : "")} disabled={disabled} onClick={() => onChange(!value)} role="switch" aria-checked={value}>
      <span className="track"><span className="knob" /></span>{text}
    </button>
  );
  const btn = (text: string, onClick: () => void, opts?: { color?: string; disabled?: boolean; big?: boolean; ghost?: boolean; cls?: string }) => (
    <button key={text} className={"ui-btn" + (opts?.big ? " big" : "") + (opts?.ghost ? " ghost" : "") + (opts?.cls ? " " + opts.cls : "")} onClick={onClick} disabled={opts?.disabled} style={cvar(opts?.color ?? C.teal)}>{text}</button>
  );
  const field = (title: string, children: JSX.Element | JSX.Element[] | null, note?: string) => (
    <div className="ui-field">
      <span className="ui-lbl">{title}</span>
      <div className="ui-row">{children}</div>
      {note ? <span className="ui-note">{note}</span> : null}
    </div>
  );
  const input = (value: string, onChange: (v: string) => void, ph: string, w?: number) => (
    <input key={ph} className="ui-input" value={value} placeholder={ph} maxLength={16} onChange={(e: { target: { value: string } }) => onChange(e.target.value)} style={{ flex: `1 1 ${w ?? 140}px` }} />
  );
  const reasonLine = (x: Reason, k: number) => {
    const small = x.t.includes("표본 부족");
    const text = x.t.replace(/ · 표본 부족/g, "");
    return (
      <div key={k} className={"rsn" + (x.warn ? " warn" : "") + (small ? " small" : "")}>
        <i />
        <span>{text}{small && text === x.t ? null : small ? <em className="b-small">표본 부족</em> : null}</span>
      </div>
    );
  };
  const statLine = (txt: string) => {
    const small = txt.includes("표본 부족");
    return <span className={"stat" + (small ? " small" : "")}>{txt.replace(/ · 표본 부족/g, "")}{small ? <em className="b-small">표본 부족</em> : null}</span>;
  };

  // ---------- team pieces ----------
  const banSlot = (side: Ord, i: number, id: string | undefined) => {
    const active = !!cur && cur.side === side && cur.kind === "ban" && cur.n === i + 1;
    const cs = colorOf(side);
    const preview = active && humanTurn && sel ? sel : null;
    const show = id && id !== "NONE" ? id : preview;
    return (
      <div key={side + "b" + i} className={"ban" + (id ? " filled" : "")} title={id ? (id === "NONE" ? "밴 없음" : `밴: ${nameOf(id)}`) : `${lbl(side)} ${i + 1}밴`} style={{ borderColor: active ? TEAM[cs] : undefined, animation: active ? `dlGlow${cs} 1.6s ease-in-out infinite` : undefined }}>
        {show ? <div key={show} className={"ban-art" + (id ? " gone" : " prev")}><Art id={show} kind="square" size={44} fill radius={0} /></div> : null}
        {id && id !== "NONE" ? <span className="ban-x" /> : null}
        {id === "NONE" ? <span className="ban-n">없음</span> : null}
        {!id && !preview ? <span className="ban-n">{i + 1}</span> : null}
      </div>
    );
  };
  const pickCard = (side: Ord, i: number, id: string | undefined, posTag: Pos | null) => {
    const active = !!cur && cur.side === side && cur.kind === "pick" && cur.n === i + 1;
    const cs = colorOf(side);
    const col = TEAM[cs];
    const mirror = cs === "R";
    const preview = active && humanTurn && sel ? sel : null;
    const show = id || preview;
    const c = show ? BY[show] : null;
    return (
      <div key={side + "p" + i} className={"pick" + (mirror ? " r" : "") + (active ? " active" : "") + (id ? " locked can-vs" : "") + (id && vsPin === id && ptab === "VS" ? " vs-on" : "")} title={id && c ? `클릭하면 ${c.name} 상성을 봅니다` : undefined}
        onClick={id ? () => { setVsPin(id); setPtab("VS"); if (window.innerWidth <= 1100) document.querySelector(".coach")?.scrollIntoView({ behavior: "smooth", block: "start" }); } : undefined}
        style={{ borderColor: active ? col : undefined, animation: active ? `dlGlow${cs} 1.6s ease-in-out infinite` : undefined }}>
        {c ? <div key={show ?? "x"} className="pick-art" style={{ opacity: id ? 1 : 0.45, animation: id ? "dlLock .65s cubic-bezier(.2,.8,.2,1) both" : undefined }}><Art id={c.id} kind="splash" align={mirror ? "left" : "right"} sizes="(min-width: 1600px) 420px, 300px" /></div> : null}
        {active && !id ? <div className="pick-shimmer" style={{ background: `linear-gradient(100deg, transparent 25%, ${col}30 50%, transparent 75%)` }} /> : null}
        <div className="pick-shade" style={{ background: `linear-gradient(${mirror ? "270deg" : "90deg"}, ${C.bg}F2 0%, ${C.bg}A8 42%, ${col}14 72%, transparent 100%)` }} />
        <div className="pick-bar" style={{ background: `linear-gradient(180deg, ${HI[cs]}, ${col})`, boxShadow: `0 0 12px ${col}` }} />
        <div className="pick-t">
          <div className="pick-k" style={{ color: active ? HI[cs] : C.sub }}>
            {posTag ? <PosIcon p={posTag} size={13} color={HI[cs]} /> : null}
            <span>{active ? (isAISide(side) ? "AI 선택 중" : "선택 중") : id ? (posTag ? POS_KO[posTag] : "포지션 미정") : ready ? `${ORD_KO[side]} ${i + 1}픽${side === "L" && i === 4 ? " · 마지막" : ""}` : `PICK ${i + 1}`}</span>
          </div>
          <span className="pick-name" style={{ color: id ? C.text : preview ? C.sub : C.dim }}>{c ? c.name : "—"}</span>
          {id && c ? statLine(proLine(c)) : null}
        </div>
      </div>
    );
  };
  const teamHead = (cs: Side) => {
    const side = ordAt(cs);
    const bans = side === "F" ? bansF : bansL;
    const mirror = cs === "R";
    const on = !!cur && cur.side === side;
    const nm = blueTeam !== null ? keyName(cs === "B" ? bT : otherKey(bT)) : "진영 미정";
    return (
      <div className={"thead" + (mirror ? " r" : "")} style={{ background: `linear-gradient(${mirror ? "270deg" : "90deg"}, ${TEAM[cs]}${on ? "4D" : "2E"}, ${TEAM[cs]}0D 70%, transparent)`, borderColor: `${TEAM[cs]}${on ? "88" : "44"}` }}>
        <div className="tname">
          <span className="tside" style={{ color: HI[cs] }}>{ready ? `${ORD_KO[side]} · ${SIDE_KO[cs]}` : `${SIDE_KO[cs]} · 순서 미정`}{ready && isAISide(side) ? ` · AI ${diff === "easy" ? "쉬움" : diff === "normal" ? "보통" : "프로"}` : ""}</span>
          <b title={nm}>{nm}</b>
        </div>
        <div className="bans">{[0, 1, 2, 3, 4].map((i: number) => banSlot(side, i, bans[i]))}</div>
      </div>
    );
  };
  const pickCol = (cs: Side) => {
    const side = ordAt(cs);
    const picks = side === "F" ? picksF : picksL;
    const pa = assign(picks);
    return <div className={"picks" + (cs === "R" ? " r" : "")}>{[0, 1, 2, 3, 4].map((i: number) => { const id = picks[i]; return pickCard(side, i, id, id ? pa[id] : null); })}</div>;
  };

  // ---------- timer ring ----------
  const ring = () => {
    if (!cur) return null;
    const ai = isAISide(cur.side);
    const r = 24;
    const circ = 2 * Math.PI * r;
    const frac = ai || N === 0 ? 1 : Math.max(0, Math.min(1, left / N));
    const col = !ai && N > 0 && left <= 10 ? C.bad : TEAM[colorOf(cur.side)];
    const canPause = !ai && N > 0;
    return (
      <button className="ring" onClick={canPause ? () => setPaused(!paused) : undefined} disabled={!canPause} title={canPause ? (paused ? "클릭하면 재개합니다" : "클릭하면 일시정지합니다") : undefined}>
        <svg width="62" height="62" viewBox="0 0 62 62" style={{ animation: ai ? "dlSpin 1.6s linear infinite" : undefined }}>
          <circle cx="31" cy="31" r={r} fill="none" stroke="rgba(148,163,184,.16)" strokeWidth="5" />
          <circle cx="31" cy="31" r={r} fill="none" stroke={col} strokeWidth="5" strokeLinecap="round" strokeDasharray={ai ? `${circ * 0.25} ${circ}` : `${circ}`} strokeDashoffset={ai ? 0 : circ * (1 - frac)} transform="rotate(-90 31 31)" style={{ transition: "stroke-dashoffset 1s linear, stroke .3s", filter: `drop-shadow(0 0 5px ${col})` }} />
        </svg>
        <span className="ring-v" style={{ color: col === C.bad ? C.bad : C.text, fontSize: ai ? 14 : 21, animation: !ai && N > 0 && left <= 10 && !paused ? "dlBlink 1s ease-in-out infinite" : undefined }}>{ai ? "AI" : N === 0 ? "∞" : left}</span>
        {canPause ? <span className="ring-s">{paused ? "재개" : "일시정지"}</span> : null}
      </button>
    );
  };

  // ---------- analysis ----------
  const focus = hover ?? sel;
  const fc = focus ? BY[focus] : null;
  const blueAt = atMap(assign(picksB));
  const redAt = atMap(assign(picksR));
  const fAt = atMap(assign(picksF));
  const lAt = atMap(assign(picksL));
  const sTag = (sd: Side): string => `${SIDE_KO[sd]}·${ORD_KO[ordAt(sd)]} 팀`;
  const teamOn = (sd: Side): string => keyName(sd === "B" ? bT : otherKey(bT));
  const analyze = (side: Side) => {
    const pk = side === "B" ? picksB : picksR;
    const cs = champs(pk);
    const idn = identity(pk);
    const main = idn[0];
    const second = idn[1] && idn[1].v >= main.v * 0.6 && idn[1].v > 0 ? idn[1] : null;
    let e = 0;
    for (const c of cs) { if (EARLY.includes(c.id)) e += 1; if (LATE.includes(c.id)) e -= 1; if (c.gd && c.gd[0] >= 10) e += c.gd[1] / 300; }
    const tempo = e >= 1.5 ? "초반 주도형" : e <= -1.5 ? "후반 지향형" : "중반 교전형";
    const spike = e >= 1.5 ? "라인 주도권으로 첫 전령·첫 드래곤을 선점하고, 상대가 성장하기 전에 격차를 굳혀야 합니다." : e <= -1.5 ? "초반엔 손해 없이 버티고, 핵심 아이템이 갖춰지는 중후반 한타에서 화력이 극대화됩니다." : "첫 전령부터 2번째 드래곤 전후의 교전 구간이 승부처입니다.";
    const gdList = cs.filter((c: Champ) => c.gd && c.gd[0] >= 10).sort((a: Champ, b: Champ) => Math.abs((b.gd as number[])[1]) - Math.abs((a.gd as number[])[1])).slice(0, 3).map((c: Champ) => `${c.name} ${(c.gd as number[])[1] > 0 ? "+" : ""}${(c.gd as number[])[1]} (${(c.gd as number[])[0]}경기)`);
    const at = atMap(assign(pk));
    const cover = ALL_POS.filter((p: Pos) => !!at[p]).length;
    const d = dmgSplit(cs);
    const fr = cs.filter(isFront).length;
    const en = cs.filter(isEngage).length;
    const checks = [
      { k: "포지션", v: `${cover}/5`, ok: cover === 5 },
      { k: "딜 구성", v: `AD ${d.ad} : AP ${d.ap}`, ok: Math.min(d.ad, d.ap) >= 1.5 },
      { k: "앞라인", v: `${fr}명`, ok: fr >= 1 },
      { k: "이니시", v: `${en}명`, ok: en >= 1 },
    ];
    return { main, second, tempo, spike, gdList, checks, d, fr, en };
  };
  const aB = done ? analyze("B") : null;
  const aR = done ? analyze("R") : null;
  const lanes = ALL_POS.map((p: Pos) => {
    const b = blueAt[p];
    const r = redAt[p];
    const m = b && r ? mu(PI[p], BY[b].i, BY[r].i) : null;
    const k = b && r ? rkOk(rk(p, b, r)) : null;
    return { p, b, r, m, k };
  });
  // ---------- 라인 주도권 · 첫 오브젝트 (교수님 요청 2026-11-12) ----------
  // 라인전 지표(GD@15)·챔피언 성향·랭크/프로 상성·바텀 2:2 대회 기록으로 라인별 주도권을 점수로 비교 (참고용)
  type Ev = { t: string; v: number; small?: boolean };
  const sideWord = (d: number, th: number): Side | null => (d >= th ? "B" : d <= -th ? "R" : null);
  const champEv = (id: string, p: Pos): Ev[] => {
    const c = BY[id];
    const ev: Ev[] = [];
    if (c.gd && c.gd[0] >= 5) { const v = (c.gd[1] * c.gd[0]) / (c.gd[0] + (c.gd[0] < SMALL ? 40 : 15)) / 150; ev.push({ t: `${c.name} GD@15 ${c.gd[1] > 0 ? "+" : ""}${c.gd[1]} (${c.gd[0]}경기)`, v, small: c.gd[0] < SMALL }); }
    if (EARLY.includes(c.id)) ev.push({ t: `${c.name} 초반형`, v: 0.8 });
    if (LATE.includes(c.id)) ev.push({ t: `${c.name} 후반형(초반 약함)`, v: -0.8 });
    if (p === "S" || p === "A") {
      if (SETS.poke.includes(c.id) && c.ranged) ev.push({ t: `${c.name} 원거리 견제(라인 압박)`, v: 0.7 });
      else if (p === "S" && isEngage(c)) ev.push({ t: `${c.name} 이니시(올인 압박)`, v: 0.5 });
      else if (p === "S" && c.ut >= 3 && !c.ranged) ev.push({ t: `${c.name} 보호형(라인 압박 약함)`, v: -0.3 });
    }
    if (p === "T" || p === "M") { if (c.ranged && c.d >= 3) ev.push({ t: `${c.name} 원거리 견제`, v: 0.3 }); }
    return ev;
  };
  const prio = (() => {
    if (!done) return null;
    const rowOf = (key: string, ps: Pos[]) => {
      const bIds = ps.map((p: Pos) => blueAt[p]).filter(Boolean) as string[];
      const rIds = ps.map((p: Pos) => redAt[p]).filter(Boolean) as string[];
      const bEv: Ev[] = []; const rEv: Ev[] = [];
      ps.forEach((p: Pos) => { if (blueAt[p]) bEv.push(...champEv(blueAt[p] as string, p)); if (redAt[p]) rEv.push(...champEv(redAt[p] as string, p)); });
      for (const p of ps) {
        const b = blueAt[p], r = redAt[p];
        if (!b || !r) continue;
        const k = rkOk(rk(p, b, r));
        if (k) { const v = (rkAdj(k) - 0.5) * 30; (v >= 0 ? bEv : rEv).push({ t: `${POS_KO[p]} 랭크 상성 ${(v >= 0 ? k.wr : 100 - k.wr).toFixed(1)}% (${rkN(k.n)}판)`, v: Math.abs(v), small: k.n < RK_SMALL }); }
        const m = mu(PI[p], BY[b].i, BY[r].i);
        if (m && m.n >= 3) { const v = (shr(m.w, m.n, 6) - 0.5) * 8; (v >= 0 ? bEv : rEv).push({ t: `${POS_KO[p]} 프로 맞대결 ${rate(v >= 0 ? m.w : m.n - m.w, m.n)}`, v: Math.abs(v), small: m.n < SMALL }); }
      }
      if (key === "BOT") {
        for (const [at, ev] of [[blueAt, bEv], [redAt, rEv]] as [Partial<Record<Pos, string>>, Ev[]][]) {
          const a = at.A, s = at.S;
          if (!a || !s) continue;
          const y = syn(PI.A, BY[a].i, PI.S, BY[s].i);
          if (y && y.n >= 3) { const v = (shr(y.w, y.n, 6) - 0.5) * 6; ev.push({ t: `${BY[a].name}+${BY[s].name} 대회 ${y.w}승 ${y.n - y.w}패`, v, small: y.n < SMALL }); }
        }
      }
      const sum = (ev: Ev[]) => ev.reduce((x: number, e: Ev) => x + e.v, 0);
      const d = sum(bEv) - sum(rEv);
      return { key, ps, bIds, rIds, bEv, rEv, d };
    };
    const top = rowOf("TOP", ["T"]);
    const mid = rowOf("MID", ["M"]);
    const bot = rowOf("BOT", ["A", "S"]);
    // 정글: 대회에서 정글로 쓰였을 때 팀의 첫 드래곤·첫 유충·첫 전령·퍼블 선취율
    const jg = (id: string | undefined) => { const c = id ? BY[id] : null; const j = c ? JGM[c.i] : null; return c && j && j.n >= 5 ? { c, j } : null; };
    const jb = jg(blueAt.J), jr = jg(redAt.J);
    const rt = (k: number, n: number): number => (k + 5) / (n + 10);
    const jDrag = (jb ? rt(jb.j.fd, jb.j.n) : 0.5) - (jr ? rt(jr.j.fd, jr.j.n) : 0.5);
    const jTop = (jb ? (rt(jb.j.fh, jb.j.n) + rt(jb.j.fv, jb.j.n)) / 2 : 0.5) - (jr ? (rt(jr.j.fh, jr.j.n) + rt(jr.j.fv, jr.j.n)) / 2 : 0.5);
    const jTxt = (x: ReturnType<typeof jg>) => x ? `${x.c.name}: 첫 드래곤 ${pct(x.j.fd / x.j.n)} · 유충 우세 ${pct(x.j.fv / x.j.n)} · 첫 전령 ${pct(x.j.fh / x.j.n)} (정글 ${x.j.n}경기)${x.j.n < SMALL ? " · 표본 부족" : ""}` : "정글 대회 표본 5경기 미만 (—)";
    const drag = bot.d + mid.d * 0.5 + jDrag * 5;
    const herald = top.d + mid.d * 0.5 + jTop * 5;
    // 결론에 "무엇이 어느 쪽을 미는지"를 같이 적기
    const part = (name: string, d: number, th: number): string => { const w = sideWord(d, th); return `${name} ${w ? `${SIDE_KO[w]} 우세` : "비슷"}`; };
    const dragWhy = [part("바텀", bot.d, 0.6), part("미드", mid.d, 0.6), part("정글 첫 드래곤 선취", jDrag, 0.06)].join(" · ");
    const heraldWhy = [part("탑", top.d, 0.6), part("미드", mid.d, 0.6), part("정글 유충·전령 선취", jTop, 0.06)].join(" · ");
    return { rows: [top, mid, bot], jDrag, jTop, jbTxt: jTxt(jb), jrTxt: jTxt(jr), drag, herald, dragWhy, heraldWhy };
  })();
  const points: string[] = [];
  if (done && prio) {
    const bot = prio.rows[2];
    const w = sideWord(prio.drag, 0.6);
    const botNames = (ids: string[]) => ids.map(nameOf).join("·");
    const bw = sideWord(bot.d, 0.6);
    if (w) points.push(`첫 드래곤: ${J(sTag(w), "가")} 유리할 가능성이 큽니다 (${prio.dragWhy}). ${bw === w ? `바텀 ${botNames(w === "B" ? bot.bIds : bot.rIds)}의 라인 주도권으로 먼저 밀고 정글이 합류하는 그림입니다. ` : ""}불리한 쪽은 첫 드래곤을 무리하게 지키기보다 탑·유충 쪽 교환을 준비하세요.`);
    else points.push(`첫 드래곤: 한쪽으로 기울지 않습니다 (${prio.dragWhy}).${bw ? ` 바텀은 ${botNames(bw === "B" ? bot.bIds : bot.rIds)} 쪽이 라인을 먼저 밀 수 있으니, 그 팀 정글이 바텀으로 먼저 오면 첫 드래곤을 가져가기 쉽습니다.` : " 정글 동선(누가 먼저 바텀에 오는지)이 첫 드래곤을 가릅니다."}`);
  }
  if (done && aB && aR) {
    const rkLanes = lanes.filter((l: { k: Rk | null }) => !!l.k).sort((x: { k: Rk | null }, y: { k: Rk | null }) => Math.abs(rkAdj(y.k as Rk) - 0.5) - Math.abs(rkAdj(x.k as Rk) - 0.5));
    const withData = lanes.filter((l: { m: { n: number; w: number } | null }) => l.m && l.m.n >= SMALL);
    if (rkLanes.length) {
      const l = rkLanes[0];
      const k = l.k as Rk;
      const blueWin = k.wr >= 50;
      const wc = blueWin ? l.b : l.r;
      const lc = blueWin ? l.r : l.b;
      points.push(`${POS_KO[l.p]} 라인: ${sTag(blueWin ? "B" : "R")} ${J(nameOf(wc as string), "이")} ${nameOf(lc as string)} 상대로 랭크 승률 ${(blueWin ? k.wr : 100 - k.wr).toFixed(1)}% (${rkN(k.n)}판 · 랭크 ${LP_META.tierLabel} 패치 ${LP_META.patch})${k.n < RK_SMALL ? " · 표본 부족" : ""}. 불리한 쪽은 이 라인에 정글 동선과 시야를 먼저 배분해야 합니다.`);
    } else if (withData.length) {
      const l = withData.sort((x: { m: { n: number; w: number } | null }, y: { m: { n: number; w: number } | null }) => Math.abs((y.m as { n: number; w: number }).w / (y.m as { n: number; w: number }).n - 0.5) - Math.abs((x.m as { n: number; w: number }).w / (x.m as { n: number; w: number }).n - 0.5))[0];
      const m = l.m as { n: number; w: number };
      const bw = m.w / m.n;
      const winSide: Side = bw >= 0.5 ? "B" : "R";
      const wc = winSide === "B" ? l.b : l.r;
      const lc = winSide === "B" ? l.r : l.b;
      points.push(`${POS_KO[l.p]} 라인: ${sTag(winSide)} ${J(nameOf(wc as string), "이")} ${nameOf(lc as string)} 상대로 프로 맞대결 ${rate(winSide === "B" ? m.w : m.n - m.w, m.n)}. 불리한 쪽은 이 라인에 정글 동선과 시야를 먼저 배분해야 합니다.`);
    } else points.push("다섯 라인 모두 랭크 상성 상위 5에 없고 프로 맞대결도 10경기 미만입니다. 라인 상성은 챔피언 특성으로 토론해 보세요.");
    const nB = sTag("B"); const nR = sTag("R");
    points.push(`구도: ${J(nB, "는")} ${IDN[aB.main.k].short}, ${J(nR, "는")} ${IDN[aR.main.k].short}. 어느 쪽이 먼저 자기 구도를 만드느냐가 승부처입니다.`);
    if (aB.tempo !== aR.tempo) points.push(`템포: ${nB} ${aB.tempo} vs ${nR} ${aR.tempo}. ${aB.tempo === "초반 주도형" || aR.tempo === "후반 지향형" ? `${J(nB, "가")} 초반에 격차를 만들지 못하면 ${J(nR, "가")} 시간을 벌수록 유리해집니다.` : `${J(nR, "가")} 초반에 격차를 만들지 못하면 ${J(nB, "가")} 시간을 벌수록 유리해집니다.`}`);
    ([["B", aB], ["R", aR]] as [Side, NonNullable<typeof aB>][]).forEach((pair: [Side, NonNullable<typeof aB>]) => {
      const x = pair[1];
      if (x.fr === 0) points.push(`${J(sTag(pair[0]), "는")} 앞라인이 없습니다. 한타에서 누가 먼저 맞아 줄지, 어떻게 거리를 유지할지 정해야 합니다.`);
      if (Math.min(x.d.ad, x.d.ap) < 1) points.push(`${J(sTag(pair[0]), "는")} ${x.d.ad > x.d.ap ? "물리" : "마법"} 피해에 치우쳐 있습니다(AD ${x.d.ad} : AP ${x.d.ap}). 상대 방어 아이템 한 종류에 막힐 위험이 있습니다.`);
    });
    const r5 = acts[19].id;
    const r5p = (Object.keys(lAt) as Pos[]).find((p: Pos) => lAt[p] === r5);
    if (r5p && fAt[r5p]) {
      const m = mu(PI[r5p], BY[r5].i, BY[fAt[r5p] as string].i);
      const k5 = rkOk(rk(r5p, r5, fAt[r5p] as string));
      if (k5) points.push(`후픽 5픽(마지막 픽) ${nameOf(r5)}: ${nameOf(fAt[r5p] as string)} 상대 랭크 승률 ${k5.wr.toFixed(1)}% (${rkN(k5.n)}판 · 랭크 ${LP_META.tierLabel})${m ? ` · 프로 맞대결 ${rate(m.w, m.n)}` : ""}. 카운터픽 의도가 데이터와 맞았는지 확인해 보세요.`);
      else points.push(m ? `후픽 5픽(마지막 픽) ${nameOf(r5)}: ${nameOf(fAt[r5p] as string)} 상대 프로 승률 ${rate(m.w, m.n)}. 카운터픽 의도가 데이터와 맞았는지 확인해 보세요.` : `후픽 5픽(마지막 픽) ${nameOf(r5)}: ${J(nameOf(fAt[r5p] as string), "와")}의 랭크 상성(상위 5)과 프로 맞대결 표본이 모두 없습니다(—). 어떤 카운터 의도였는지 토론해 보세요.`);
    }
    if (fearless && setNo < (fear5Off ? 4 : 5)) {
      const pickedNow = [...picksB, ...picksR].filter((id: string) => BY[id]).sort((a: string, b: string) => pres(BY[b]) - pres(BY[a]));
      if (pickedNow.length) points.push(`피어리스: 이번 세트 10명은 다음 세트부터 잠깁니다. 특히 ${nameOf(pickedNow[0])}(프로 밴픽률 ${pct(pres(BY[pickedNow[0]]))})가 빠지면 다음 세트의 1차 밴 우선순위가 달라집니다.`);
    }
  }

  const logLines: string[] = acts.map((a: Act, i: number) => {
    const s = STEPS[i];
    const tail = a.by === "ai" ? ` (AI: ${a.reason})` : a.by === "timeout" ? ` (${a.reason})` : "";
    return `${phaseName(i)} · ${ORD_KO[s.side]} 팀(${SIDE_KO[colorOf(s.side)]}) ${s.n}${s.kind === "ban" ? "밴" : "픽"}${i === 19 ? "(마지막 픽)" : ""}: ${nameOf(a.id)}${tail}`;
  });
  const questions: string[] = [];
  if (done) {
    const b1 = acts[6].id;
    if (selTeam && selWhat) questions.push(`첫 번째 선택권: ${J(keyName(selTeam), "은")} ${selWhat === "side" ? `${SIDE_KO[colorOf(keyOf("F") === selTeam ? "F" : "L")]} 진영` : `${keyOf("F") === selTeam ? "선픽" : "후픽"}`}을 먼저 골랐습니다. ${selWhat === "side" ? "밴픽 순서" : "진영"}를 먼저 골랐다면 드래프트가 어떻게 달라졌을까요?`);
    questions.push(`선픽 팀(${SIDE_KO[colorOf("F")]}) 1픽 ${nameOf(b1)}: 왜 가장 먼저 가져갔을까요?${FP2[b1] ? ` (프로에서 팀 첫 픽 ${FP2[b1]}회 / ${(NG * 2).toLocaleString("ko-KR")}드래프트)` : ""}`);
    questions.push(`후픽 팀(${SIDE_KO[colorOf("L")]}) 1·2픽 ${nameOf(acts[7].id)}, ${nameOf(acts[8].id)}: 두 챔피언은 어떤 시너지를 노렸나요?`);
    questions.push(`2차 밴 ${[12, 13, 14, 15].map((i: number) => nameOf(acts[i].id)).join(", ")}: 각 밴은 상대의 어느 포지션을 겨냥했나요?`);
    questions.push(`후픽 5픽(마지막 픽) ${nameOf(acts[19].id)}: 상대 조합을 모두 본 뒤 고른 카운터픽입니다. 무엇을 노렸을까요?`);
    questions.push("AI 코치 추천 1순위와 실제 선택이 달랐던 차례는 어디였고, 그 이유는 무엇이었나요?");
  }

  // ---------- render ----------
  const phaseEn = step < 6 ? "BAN PHASE 1" : step < 12 ? "PICK PHASE 1" : step < 16 ? "BAN PHASE 2" : "PICK PHASE 2";
  const locked = drafting && !!cur;
  const tierCell = (x: TierItem) => {
    const why = offWhy(x.c.id);
    const can = !why && humanTurn;
    const l = POSW[x.c.i] ? POSW[x.c.i][PI[ptab as Pos]] : 0;
    return (
      <div key={x.c.id} className={"tcell" + (why ? " off" : "") + (can ? " dl-tile" : "") + (sel === x.c.id ? " on" : "")} onClick={() => { setVsPin(x.c.id); if (!why) choose(x.c.id); }} onMouseEnter={() => setHover(x.c.id)} onMouseLeave={() => setHover(null)} title={`${x.c.name} · ${POS_KO[ptab as Pos]} ${x.n}경기 · 승률 ${rate(l, x.n)}${why ? ` · 사용 불가: ${why}` : ""}`}>
        <div className="dl-ring tcell-i"><Art id={x.c.id} kind="square" size={40} radius={9} />{why ? <span className="why">{why}</span> : null}</div>
        <span className={"tcell-v" + (x.n < SMALL ? " small" : x.wr >= 0.55 ? " hi" : "")}>{x.n < SMALL ? `${l}승${x.n - l}패` : pct(x.wr)}</span>
      </div>
    );
  };
  const recRow = (r: Rec, idx: number, compact: boolean, maxS: number, minS: number) => {
    const c = BY[r.id];
    const w = maxS === minS ? 100 : 35 + 65 * ((r.score - minS) / (maxS - minS));
    const on = sel === r.id;
    const tr = ptab !== "ALL" ? tierOf(ptab, r.id) : "";
    return (
      <div key={r.id + "-" + step + "-" + ptab} className={"rec dl-rec" + (on ? " on" : "") + (humanTurn ? " can" : "") + (compact ? " cmp" : "")} title={`${c.name} — ${topReasons(r, 4).map((x: Reason) => x.t).join(" / ") || "메타·조합 종합 점수 상위"}`} onClick={() => { setVsPin(r.id); choose(r.id); }} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} style={{ animationDelay: `${idx * 45}ms` }}>
        <div className="rec-bg"><Art id={r.id} kind="splash" align="right" sizes="320px" /></div>
        <div className="rec-i">
          <div className="dl-sq-wrap" style={{ boxShadow: idx === 0 ? `0 0 0 2px ${C.teal}, 0 0 14px ${C.teal}66` : `0 0 0 1px ${C.line2}`, borderRadius: 10 }}><Art id={r.id} kind="square" size={compact ? 38 : 42} radius={10} /></div>
          <span className={"rk" + (idx === 0 ? " top" : "")}>{idx + 1}</span>
        </div>
        <div className="rec-m">
          <div className="rec-h">
            <b>{c.name}</b>
            {tr ? <span className="tier-b" style={{ background: TIER_C[tr], color: tr === "S" ? "#1A1200" : tr === "A" ? "#04201C" : C.text }}>{tr === "—" ? "표본 부족" : `${tr} 티어`}</span> : null}
            <span className="rec-pos">{r.pos ? <PosIcon p={r.pos} size={12} /> : null}{r.pos ? POS_KO[r.pos] : c.pos.map((x: Pos) => POS_KO[x]).join("/")}</span>
          </div>
          {maxS !== 0 || minS !== 0 ? <div className="rec-bar"><i style={{ width: `${w}%`, background: `linear-gradient(90deg, ${C.teal}, ${cur && cur.kind === "ban" ? C.bad : cur ? TEAM[colorOf(cur.side)] : C.teal})` }} /></div> : null}
          {topReasons(r, compact ? 1 : 2).map(reasonLine)}
          {!topReasons(r, 1).length ? <div className="rsn"><i /><span>메타·조합 종합 점수 상위</span></div> : null}
        </div>
      </div>
    );
  };
  const counterPanel = () => {
    // 고정된 챔피언(클릭) > 선택 중 > 마우스 미리보기 순. 고정 중에는 마우스 이동으로 바뀌지 않습니다.
    const pinId = vsPin ?? sel;
    const vc = pinId ? BY[pinId] : hover ? BY[hover] : null;
    const tierBar = (
      <div className="cv-tier" role="group" aria-label="랭크 티어 설정">
        <span>랭크 티어</span>
        {RK_TIERS.map((t: number) => <button key={t} className={"ui-chip" + (rkTier === t ? " on" : "")} onClick={() => setRkTierState(t)} title={`${LP_METAS[t].tierLabel} · ${rkN(LP_METAS[t].games)}경기 · 맞대결 ${rkN(LP_METAS[t].listed)}쌍 중 ${RK_MIN}판 이상 ${rkN(LP_METAS[t].n30)}쌍`}>{LP_METAS[t].tierLabel}</button>)}
      </div>
    );
    if (!vc) return <Fragment>{tierBar}<div className="empty">챔피언을 클릭하면 랭크 기준 상대하기 어려운/쉬운 챔피언이 여기에 고정되어 표시됩니다.</div></Fragment>;
    const avl = lpLanes(vc.id);
    const pinned = !!pinId;
    const pinBar = (
      <div className={"cv-pin" + (pinned ? "" : " prev")} title={pinned ? "다른 챔피언을 클릭하면 바뀝니다. 마우스를 올리는 것만으로는 바뀌지 않습니다." : "클릭하면 이 챔피언으로 고정됩니다."}>
        {pinned ? <Fragment><span className="pin-on">고정</span><span>{vc.name} · 클릭할 때만 바뀝니다</span>{vsPin ? <button className="pin-x" onClick={() => setVsPin(null)} aria-label="고정 해제">해제</button> : null}</Fragment> : <span>미리보기 · {vc.name} (클릭하면 고정)</span>}
      </div>
    );
    if (!avl.length) return <Fragment>{tierBar}{pinBar}<div className="empty">{vc.name}: 랭크 데이터 없음 (이 티어에서 20판 미만이거나 라인 비율 5% 미만)</div></Fragment>;
    const rp = (top5.find((r: Rec) => r.id === vc.id) || posRecs.find((r: Rec) => r.id === vc.id))?.pos ?? null;
    const lane: Pos = vsLane && avl.includes(vsLane) ? vsLane : rp && avl.includes(rp) ? rp : avl[0];
    const E = LP[`${PI[lane]}|${vc.id}`];
    const ratio: [number, number | null] | undefined = E ? [PI[lane], E.r] : undefined;
    const enAt = cur ? (cur.side === "F" ? lAt : fAt) : {};
    const opp = enAt[lane];
    const ok = opp && opp !== vc.id ? rk(lane, vc.id, opp) : null;
    // 상성 탭의 챔피언 줄도 눌러서 이번 차례 밴·픽으로 고를 수 있음 (교수님 요청 2026-11-12)
    const row = (x: LpRow, kind: string, low: boolean) => {
      const can = humanTurn && !!BY[x[0]] && status(x[0]) === "free";
      const why = BY[x[0]] ? offWhy(x[0]) : "";
      return (
      <div key={kind + x[0]} className={"cv-row" + (x[2] < RK_SMALL ? " small" : "") + (low ? " low" : "") + (can ? " can" : why ? " off" : "") + (sel === x[0] ? " on" : "")}
        onClick={can ? () => choose(x[0]) : undefined} onDoubleClick={can ? () => confirm(x[0]) : undefined}
        title={`${vc.name}의 ${nameOf(x[0])} 상대 승률 ${x[1].toFixed(1)}% · ${rkN(x[2])}판${low ? ` · ${RK_MIN}판 미만이라 우연일 가능성이 큽니다` : ""}${can ? ` · 클릭하면 ${nameOf(x[0])}을(를) 이번 차례로 고릅니다` : why ? ` · ${why}` : ""}`}>
        <Art id={x[0]} kind="square" size={28} radius={7} />
        <span className="cv-n">{nameOf(x[0])}{why ? <em className="cv-off">{why}</em> : null}</span>
        <span className={"cv-w " + (low ? "" : kind)}>{x[1].toFixed(1)}%</span>
        <span className="cv-c">{rkN(x[2])}판{x[2] < RK_SMALL ? <em className="b-small">표본 부족</em> : null}</span>
      </div>
      );
    };
    const sec = (title: string, kind: string, list: LpRow[] | undefined) => {
      const all = list || [];
      const good = all.filter((x: LpRow) => x[2] >= RK_MIN).sort((a: LpRow, b: LpRow) => (kind === "bad" ? a[1] - b[1] : b[1] - a[1]));
      const low = all.filter((x: LpRow) => x[2] < RK_MIN).sort((a: LpRow, b: LpRow) => b[2] - a[2]);
      return (
        <div className="cv-sec">
          <span className={"cv-h " + kind}>{title}</span>
          {!all.length ? <div className="empty">랭크 데이터 없음</div> : good.length ? good.slice(0, 6).map((x: LpRow) => row(x, kind, false)) : <div className="cv-none">신뢰할 만한 표본 없음 — 이 목록의 매치업은 모두 {RK_MIN}판 미만입니다.</div>}
          {low.length ? (
            <div className="cv-low">
              <button className="cv-low-t" aria-expanded={showLow} onClick={() => setShowLow(!showLow)}>{showLow ? "▾" : "▸"} 표본 부족 (참고) {low.length}개 · {RK_MIN}판 미만</button>
              {showLow ? low.map((x: LpRow) => row(x, kind, true)) : null}
            </div>
          ) : null}
        </div>
      );
    };
    return (
      <Fragment>
        {tierBar}
        {pinBar}
        <div className="ch">
          <b>{vc.name} · {POS_KO[lane]} 랭크 상성</b>
          <span>랭크 {rkN(LP_META.games)}경기 · 패치 {LP_META.patch} · 티어 {tierTxt(LP_META)} · 이 라인 {E && E.n ? `${rkN(E.n)}판` : "—"}{ratio && ratio[1] != null ? ` (라인 비율 ${ratio[1]}%)` : ""}</span>
        </div>
        {avl.length > 1 ? <div className="cv-lanes">{avl.map((p: Pos) => <button key={p} className={"ui-chip" + (p === lane ? " on" : "")} onClick={() => { if (!vsPin) setVsPin(vc.id); setVsLane(p); }}><PosIcon p={p} size={12} />{POS_KO[p]}</button>)}</div> : null}
        {opp && opp !== vc.id ? <div className="ctx">{ok ? <span>현재 상대 {POS_KO[lane]} {nameOf(opp)}: {vc.name} 승률 {ok.wr.toFixed(1)}% ({rkN(ok.n)}판){ok.n < RK_MIN ? " — 표본 부족, 참고만" : ok.n < RK_SMALL ? " · 표본 부족" : ""}</span> : `현재 상대 ${POS_KO[lane]} ${nameOf(opp)}: 맞대결 5판 미만 (데이터 없음)`}</div> : null}
        {sec("상대하기 어려운 챔피언", "bad", E && E.h)}
        {sec("상대하기 쉬운 챔피언", "good", E && E.e)}
        <div className="legend">승률은 {vc.name} 기준이며 {RK_MIN}판 이상만 순위로 보여 드립니다({RK_SMALL}판 미만은 '표본 부족' 표시). 각 목록은 승률 순 상위 6개까지 보여 줍니다. 출처: Riot Games API로 모은 한국 서버 솔로 랭크 경기</div>
      </Fragment>
    );
  };
  const coach = () => {
    if (!cur) return null;
    const maxS = top5.length ? top5[0].score : 0;
    const minS = top5.length ? Math.min(...top5.map((x: Rec) => x.score)) - 4 : 0;
    return (
      <aside className="coach">
        <div className="ctabs" role="tablist">
          {(["ALL", ...ALL_POS, "VS"] as string[]).map((k: string) => (
            <button key={k} role="tab" aria-selected={ptab === k} className={"ctab" + (ptab === k ? " on" : "") + (k === "VS" ? " vs-tab" : "")} onClick={() => { setPtab(k); if (k !== "VS") setPosF(k); }}>
              {k === "VS" ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /><path d="M2 6V2h4M14 10v4h-4" /></svg> : k !== "ALL" ? <PosIcon p={k as Pos} size={14} /> : <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l1.8 4.2L14 6l-3.2 2.9.9 4.6L8 11.3 4.3 13.5l.9-4.6L2 6l4.2-.8z" /></svg>}
              <span>{k === "ALL" ? "추천" : k === "VS" ? "상성" : POS_KO[k as Pos]}</span>
            </button>
          ))}
        </div>
        <div className="cbody" key={ptab + step}>
          {ptab === "VS" ? counterPanel() : ptab === "ALL" ? (
            <Fragment>
              <div className="ch one">
                <b>AI 코치 추천</b>
                <span>{lbl(cur.side)} {cur.kind === "ban" ? "밴" : "픽"} 관점 · 프로 {NG}경기 + 랭크 상성 + 조합</span>
              </div>
              {guideExtra && !isAISide(cur.side) ? <div className="ctx">{guideExtra.split("   |   ").map((g: string) => <span key={g}>{g}</span>)}</div> : null}
              <div className="recs">{top5.map((r: Rec, idx: number) => recRow(r, idx, true, maxS, minS))}</div>
              {!top5.length ? <div className="empty">고를 수 있는 후보가 없습니다.</div> : null}
            </Fragment>
          ) : (
            <Fragment>
              <div className="ch">
                <b>지금 이 조합에 좋은 {POS_KO[ptab as Pos]}</b>
                <span>{teamName(cur.side)} 기준 · 아군·상대 픽과 밴 반영</span>
              </div>
              {ownFilled ? <div className="ctx warn">이미 {J(nameOf(ownFilled), "으로")} 채운 포지션입니다. 참고용으로 보여 드립니다.</div> : null}
              {cur.kind === "ban" ? <div className="ctx">지금은 밴 차례입니다. 우리 팀이 노릴 후보이며, 클릭하면 밴 대상으로 선택됩니다.</div> : null}
              <div className="recs">{posRecs.slice(0, 4).map((r: Rec, idx: number) => recRow(r, idx, true, 0, 0))}</div>
              {!posRecs.length ? <div className="empty">지금 고를 수 있는 {POS_KO[ptab as Pos]} 후보가 없습니다.</div> : null}
              <div className="ch" style={{ marginTop: 6 }}>
                <b>{POS_KO[ptab as Pos]} 메타 티어</b>
                <span>최근 패치 60% 가중 · 숫자는 포지션 승률</span>
              </div>
              <div className="tiers">
                {["S", "A", "B", "C", "—"].map((tr: string) => {
                  const list = (TIER[ptab] || []).filter((x: TierItem) => x.tier === tr);
                  if (!list.length) return null;
                  return (
                    <div key={tr} className="trow">
                      <span className={"tb" + (tr === "—" ? " na" : "")} style={{ background: TIER_C[tr], color: tr === "S" ? "#1A1200" : tr === "A" ? "#04201C" : C.text }} title={tr === "—" ? "기용 5경기 미만" : `${tr} 티어`}>{tr === "—" ? "표본\n부족" : tr}</span>
                      <div className="tcells">{list.slice(0, tr === "—" ? 10 : 15).map(tierCell)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="legend">흐린 아이콘은 밴·픽·피어리스로 지금 쓸 수 없는 챔피언입니다.</div>
            </Fragment>
          )}
        </div>
      </aside>
    );
  };
  const grid = () => cur ? (
    <div className="center">
      {learn && !isAISide(cur.side) ? (
        <div key={step} className="learn dl-fade" style={{ ["--tc" as string]: HI[colorOf(cur.side)] } as CSSProperties}>
          <span className="learn-k">{cur.kind === "ban" ? "BAN" : "PICK"}</span>
          <div className="learn-m">
            <b>{learnText(step, cur.kind)}</b>
            <span>{guide}{guideExtra ? ` · ${guideExtra.replace(/\s+\|\s+/g, " · ")}` : ""}</span>
            <span className="learn-h"><span className="dot-i" />청록 점이 붙은 챔피언이 추천 후보예요. 오른쪽 'AI 코치 추천'에서 이유를 볼 수 있어요.</span>
          </div>
          <button className="learn-x" onClick={() => setLearn(false)} title="도움말 끄기 (아래 막대에서 다시 켤 수 있어요)">×</button>
        </div>
      ) : null}
      <div className="filters">
        <div className="search">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="7" cy="7" r="4.8" /><path d="M10.6 10.6 14 14" strokeLinecap="round" /></svg>
          <input value={q} placeholder="챔피언 검색" aria-label="챔피언 검색" onChange={(e: { target: { value: string } }) => setQ(e.target.value)} />
        </div>
        <div className="pf">
          {chip("전체", posF === "ALL", () => setPosF("ALL"))}
          {ALL_POS.map((p: Pos) => chip(POS_KO[p], posF === p, () => setPosF(p), { icon: p }))}
        </div>
        <button className="ui-chip sort" onClick={() => setSortMeta(!sortMeta)} title="정렬 바꾸기">{sortMeta ? "메타순" : "가나다순"}</button>
      </div>
      <div className="grid">
        {shown.map((c: Champ) => {
          const st = status(c.id);
          const off = st !== "free";
          const on = sel === c.id;
          const lock = st === "fearless" ? "피어리스" : st === "perma" ? "영구 밴" : "";
          const rec = topIds.includes(c.id);
          return (
            <div key={c.id} className={"tile" + (off ? " off" : "") + (off || !humanTurn ? "" : " dl-tile") + (on ? " on" : "")} title={`${c.name} · ${c.pos.map((x: Pos) => POS_KO[x]).join("/")} · ${proLine(c)}${lock ? ` · ${lock}` : ""}`} onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)} onClick={() => { setVsPin(c.id); if (!off) choose(c.id); }} onDoubleClick={() => confirm(c.id)}>
              <div className="dl-ring tile-i" style={{ boxShadow: on ? `0 0 0 2px ${HI[colorOf(cur.side)]}, 0 0 18px ${TEAM[colorOf(cur.side)]}88` : undefined }}>
                <Art id={c.id} kind="square" size={56} radius={11} />
                {rec && !off ? <span className="dot" /> : null}
                {lock ? <span className="why">{lock}</span> : null}
              </div>
              <span className="tile-n" style={{ textDecoration: st === "used" ? "line-through" : "none" }}>{c.name}</span>
            </div>
          );
        })}
        {!shown.length ? <div className="empty">검색 결과가 없습니다.</div> : null}
      </div>
    </div>
  ) : null;
  const focusBox = () => fc ? (
    <div key={fc.id} className="focus dl-fade">
      <div className="dl-sq-wrap" style={{ borderRadius: 11, boxShadow: `0 0 0 1px ${C.teal}88, 0 0 18px ${C.teal}44` }}><Art id={fc.id} kind="square" size={46} radius={11} /></div>
      <div className="focus-m">
        <div className="focus-h"><b>{fc.name}</b><span>{fc.tags.split("").map((g: string) => TAG_KO[g]).join(" · ")} · {DMG_KO[fc.dmg]} 피해 · {fc.ranged ? "원거리" : "근접"}</span></div>
        <div className="focus-c">
          {LP_LANES[fc.id] ? <button className="fchip fbtn" onClick={() => { setVsPin(fc.id); setPtab("VS"); }}>랭크 상성 ▸</button> : <span className="fchip small">랭크 데이터 없음</span>}
          {fc.pro ? (
            <Fragment>
              <span className="fchip">밴픽률 {pct(pres(fc))}</span>
              <span className={"fchip" + (fc.pro.P < SMALL ? " small" : "")}>승률 {fc.pro.P ? rate(fc.pro.W, fc.pro.P).replace(" · 표본 부족", "") : "—"}{fc.pro.P && fc.pro.P < SMALL ? <em className="b-small">표본 부족</em> : null}</span>
              <span className="fchip">밴 {fc.pro.B}회</span>
              <span className={"fchip" + (fc.gd && fc.gd[0] >= 5 && fc.gd[0] < SMALL ? " small" : "")}>GD@15 {fc.gd && fc.gd[0] >= 5 ? `${fc.gd[1] > 0 ? "+" : ""}${fc.gd[1]} (${fc.gd[0]}경기)` : "—"}</span>
              {fc.pro.P > 0 ? <span className="fchip">{ALL_POS.filter((p: Pos) => (fc.pro as Pro).pos[PI[p]] > 0).map((p: Pos) => `${POS_KO[p]} ${(fc.pro as Pro).pos[PI[p]]}`).join(" · ")}경기</span> : null}
            </Fragment>
          ) : <span className="fchip small">프로 표본 없음 · 포지션 추정</span>}
        </div>
      </div>
    </div>
  ) : <div className="focus hint">챔피언이나 추천에 마우스를 올리면 프로 데이터가 여기에 표시됩니다. <span className="dot-i" /> 청록 점은 이번 차례 추천 후보입니다.</div>;

  // result: VS comparison panel (fills the space between the two team columns)
  const vsPanel = () => {
    if (!aB || !aR) return null;
    const dm = (s: Side, a: NonNullable<typeof aB>) => {
      const tot = a.d.ad + a.d.ap || 1;
      return (
        <div className="dmg" key={s}>
          <span className="dmg-k" style={{ color: HI[s] }}>{sLbl(s)}</span>
          <div className="dmg-bar"><i className="ad" style={{ width: `${(a.d.ad / tot) * 100}%` }} /><i className="ap" style={{ width: `${(a.d.ap / tot) * 100}%` }} /></div>
          <span className="dmg-v">AD {a.d.ad} : AP {a.d.ap}</span>
        </div>
      );
    };
    const keyLanes = lanes.filter((l: { m: { n: number; w: number } | null }) => !!l.m);
    return (
      <div className="vs dl-fade">
        <div className="vs-head">
          <span className="ui-lbl" style={{ color: C.teal }}>DRAFT COMPLETE · SET {setNo}</span>
          <div className="vs-comps">
            <b style={{ color: HI.B }}>{IDN[aB.main.k].name}{aB.second ? <small> + {IDN[aB.second.k].name}</small> : null}</b>
            <span className="vs-x">VS</span>
            <b style={{ color: HI.R }}>{IDN[aR.main.k].name}{aR.second ? <small> + {IDN[aR.second.k].name}</small> : null}</b>
          </div>
          <span className="vs-note">프로 데이터와 챔피언 특성에 근거한 참고 분석이며, 승패 예측이 아닙니다.</span>
        </div>
        <div className="vs-grid">
          <section className="vs-sec">
            <h4>딜 구성</h4>
            {dm("B", aB)}{dm("R", aR)}
            <div className="vs-legend"><span><i className="ad" />물리(AD)</span><span><i className="ap" />마법(AP)</span><span>혼합 피해는 0.5씩</span></div>
          </section>
          <section className="vs-sec">
            <h4>파워 스파이크</h4>
            {([["B", aB], ["R", aR]] as [Side, NonNullable<typeof aB>][]).map((pair: [Side, NonNullable<typeof aB>]) => (
              <div key={pair[0]} className="spk">
                <span className="spk-t" style={{ color: HI[pair[0]], borderColor: `${TEAM[pair[0]]}66` }}>{sLbl(pair[0])} · {pair[1].tempo}</span>
                <span className="spk-d">{pair[1].gdList.length ? `GD@15(${LG.label}) ${pair[1].gdList.join(", ")}` : "GD@15 표본 10경기 이상인 챔피언 없음 (—)"}</span>
              </div>
            ))}
          </section>
          <section className="vs-sec wide">
            <h4>핵심 라인 맞대결 <small>랭크 상성({LP_META.tierLabel} · 패치 {LP_META.patch}) · 프로 맞대결(10경기 미만은 전적만)</small></h4>
            {lanes.map((l: { p: Pos; b?: string; r?: string; m: { n: number; w: number } | null; k: Rk | null }) => {
              const sm = !!l.m && l.m.n < SMALL;
              const bw = l.m ? l.m.w / l.m.n : 0.5;
              return (
                <div key={l.p} className="lane">
                  <div className="lane-s">{l.b ? <Fragment><Art id={l.b} kind="square" size={30} radius={7} /><span>{nameOf(l.b)}</span></Fragment> : <span className="muted">—</span>}</div>
                  <div className="lane-m">
                    <span className="lane-p"><PosIcon p={l.p} size={12} color={C.teal} />{POS_KO[l.p]}</span>
                    {l.k ? (
                      <Fragment>
                        <div className={"lane-bar" + (l.k.n < RK_SMALL ? " small" : "")}><i style={{ width: `${l.k.wr}%` }} /></div>
                        <span className={"lane-v" + (l.k.n < RK_SMALL ? " small" : "")}>랭크 블루 {l.k.wr.toFixed(1)}% : 레드 {(100 - Number(l.k.wr.toFixed(1))).toFixed(1)}% ({rkN(l.k.n)}판){l.k.n < RK_SMALL ? <em className="b-small">표본 부족</em> : null}</span>
                      </Fragment>
                    ) : l.b && l.r ? <span className="lane-v small">랭크 맞대결 데이터 없음</span> : null}
                    {l.m ? (
                      <span className={"lane-v pro" + (sm ? " small" : "")}>{sm ? <Fragment>프로 블루 기준 {l.m.w}승 {l.m.n - l.m.w}패<em className="b-small">표본 부족</em></Fragment> : `프로 블루 ${pct(bw)} : 레드 ${pct(1 - bw)} (${l.m.n}경기)`}</span>
                    ) : <span className="lane-v pro small">{l.b && l.r ? "프로 맞대결 기록 없음 (2경기 미만)" : "포지션 미정"}</span>}
                  </div>
                  <div className="lane-s r">{l.r ? <Fragment><span>{nameOf(l.r)}</span><Art id={l.r} kind="square" size={30} radius={7} /></Fragment> : <span className="muted">—</span>}</div>
                </div>
              );
            })}
            {!keyLanes.length ? <div className="vs-legend">다섯 라인 모두 프로 맞대결 표본이 거의 없습니다.</div> : null}
          </section>
          <section className="vs-sec wide">
            <h4>조합 체크</h4>
            <div className="checks">
              {([["B", aB], ["R", aR]] as [Side, NonNullable<typeof aB>][]).map((pair: [Side, NonNullable<typeof aB>]) => (
                <div key={pair[0]} className="check-row">
                  <span style={{ color: HI[pair[0]] }}>{sLbl(pair[0])}</span>
                  {pair[1].checks.map((x: { k: string; v: string; ok: boolean }) => <em key={x.k} className={x.ok ? "ok" : "no"}>{x.k} {x.v}</em>)}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  };

  return (
    <Page title="LoL 밴픽대전 시뮬레이터" summary={stage !== "setup" ? undefined : `2026 프로 규칙(첫 번째 선택권 · 피어리스)과 대회 공식 순서(20단계)로 밴픽을 실습하고, 프로 ${LG.desc} ${NG}경기(Oracle's Elixir) 데이터로 매 차례 추천과 조합 분석을 받습니다. 모든 수치는 표본 수와 함께 표시되며, 참고용이지 승패 예측이 아닙니다.`} badges={[`프로 ${LG.label} ${NG}경기`, `패치 ${LG.patches}`, `랭크 ${LP_META.tierLabel} ${rkN(LP_META.games)}경기`, `이미지 ${PATCH}`]} footer={<SiteFooter />} hero={META_TOP.slice(0, 4).map((c: Champ) => c.id)} compact={drafting}>
      <style>{CSS}</style>
      <div className={"dl board" + (locked ? " locked" : "") + (drafting && done ? " done" : "") + (!drafting ? " setup" : "") + (big ? " big" : "")}>
        <div className="b-top">
          {teamHead("B")}
          <div className="phase">
            {drafting ? (
              <div className="prog">{STEPS.map((s: Step, i: number) => <i key={i} title={`${phaseName(i)} · ${lbl(s.side)} ${s.n}${s.kind === "ban" ? "밴" : "픽"}`} className={s.kind} style={{ background: i < step ? TEAM[colorOf(s.side)] : i === step ? HI[colorOf(s.side)] : undefined, opacity: i < step ? 0.6 : 1, boxShadow: i === step ? `0 0 10px ${TEAM[colorOf(s.side)]}` : undefined }} />)}</div>
            ) : null}
            {cur ? (
              <div className="phase-row">
                <div className="phase-t">
                  <span className="ui-lbl">{phaseEn} · {step + 1} / 20 · SET {setNo}</span>
                  <div key={step} className="ttl dl-fade">
                    <span style={{ color: HI[colorOf(cur.side)], textShadow: `0 0 22px ${TEAM[colorOf(cur.side)]}66` }}>{phaseName(step)} · {ORD_KO[cur.side]} {cur.n}{cur.kind === "ban" ? "밴" : "픽"}{cur.side === "L" && cur.kind === "pick" && cur.n === 5 ? "(마지막 픽)" : ""}</span>
                    <small>{teamName(cur.side)}{isAISide(cur.side) && teamName(cur.side) !== "AI" ? " (AI)" : ""} · {SIDE_KO[colorOf(cur.side)]}</small>
                  </div>
                  <div className="guide" title={guide}>{isAISide(cur.side) ? "AI가 추천 후보를 검토하고 있습니다…" : guide}</div>
                </div>
                {ring()}
              </div>
            ) : (
              <div className="phase-idle">
                <span className="ui-lbl" style={{ color: C.teal }}>BEST OF 5 · SET {setNo}</span>
                <div className="sets">{[1, 2, 3, 4, 5].map((n: number) => <span key={n} className={"set" + (n === setNo ? " now" : n < setNo ? " past" : "")}>SET {n}{n < setNo ? " ✓" : ""}</span>)}</div>
                <span className="mode">{mode === "ai" ? `학생 vs AI (${diff === "easy" ? "쉬움" : diff === "normal" ? "보통" : "프로"})` : "학생 vs 학생"} · {fearless ? "피어리스" : "일반 드래프트"}{proMode ? " · 프로씬" : ""}</span>
              </div>
            )}
          </div>
          {teamHead("R")}
        </div>

        <div className="b-main">
          {pickCol("B")}
          {!drafting ? (
            <div className="setup-c dl-fade">
              {!history.length ? (
                <div className="easy">
                  <div className="easy-t">
                    <b>처음이에요</b>
                    <span>설정 없이 바로 AI와 한 판 해 봅니다. 시간 제한 없이, 차례마다 지금 무엇을 하는지 쉽게 알려 드려요.</span>
                  </div>
                  {btn("바로 시작하기", easyStart, { big: true })}
                </div>
              ) : null}
              <div>
                <span className="ui-lbl" style={{ color: C.teal }}>MATCH SETUP</span>
                <h2 className="setup-h">SET {setNo} 경기 설정</h2>
                <p className="setup-p">{history.length ? `팀 이름은 그대로 이어집니다.${fearless ? ` ${fear5Off && setNo === 5 ? "5세트는 피어리스 해제 설정이라 모든 챔피언을 다시 쓸 수 있습니다." : ` 피어리스 적용 중: 이전 세트에서 양 팀이 픽한 ${fearLocked.length}개 챔피언은 이번 세트에서 쓸 수 없습니다.`}` : ""}` : "2026 프로 규칙대로 첫 번째 선택권을 정하고, 진영(블루/레드)과 밴픽 순서(선픽/후픽)를 나눠 고른 뒤 시작하세요. 학생 vs AI에서는 AI가 같은 추천 엔진으로 자기 차례와 선택을 진행합니다."}</p>
              </div>
              <div className="setup-cols">
                <div className="setup-form">
                  {field("프로 데이터 리그", LEAGUE_KEYS.map((k: string) => chip(PRO[k].label, league === k, () => setLeague(k), { title: `${PRO[k].desc} ${PRO[k].ng}경기 · 패치 ${PRO[k].patches}` })), `${LG.desc} ${NG}경기 기준으로 추천·밴픽률·승률·궁합이 바뀝니다. 같은 챔피언도 리그마다 평가가 다릅니다.`)}
                  {field("대전 방식", [chip("학생 vs 학생", mode === "pvp", () => changeMode("pvp")), chip("학생 vs AI", mode === "ai", () => changeMode("ai"))])}
                  {mode === "ai" ? field("AI 난이도", [chip("쉬움", diff === "easy", () => setDiff("easy")), chip("보통", diff === "normal", () => setDiff("normal")), chip("프로", diff === "pro", () => setDiff("pro"))], diff === "pro" ? "추천 1순위 위주로 고릅니다." : diff === "normal" ? "상위 4개 후보 중에서 점수 비례로 고릅니다." : "상위 12개 후보 중에서 고르고, 가끔 엉뚱한 선택도 합니다.") : null}
                  {field("팀 이름", mode === "ai" ? [input(nameA, setNameA, "학생 팀")] : [input(nameA, setNameA, "1팀"), input(nameB, setNameB, "2팀")])}
                  {history.length ? field(`SET ${setNo - 1} 결과`, (["A", "B"] as TeamKey[]).map((k: TeamKey) => chip(`${keyName(k)} 승리`, winners[setNo - 1] === k, () => recordWin(k))), winners[setNo - 1] ? `시리즈 ${keyName("A")} ${score.A} : ${score.B} ${keyName("B")}${score.A >= 3 || score.B >= 3 ? ` · ${J(keyName(score.A >= 3 ? "A" : "B"), "이")} 3승으로 시리즈를 가져갔습니다(연습은 계속할 수 있습니다).` : ""}` : "이긴 팀을 고르면 규칙대로 진 팀에게 첫 번째 선택권이 넘어갑니다.") : null}
                  {field(`① 첫 번째 선택권${history.length ? " · 규칙: 이전 세트 패배 팀" : ""}`, [chip(keyName("A"), selTeam === "A", () => giveSel("A", "")), chip(keyName("B"), selTeam === "B", () => giveSel("B", "")), btn("동전 던지기", () => { const k: TeamKey = Math.random() < 0.5 ? "A" : "B"; giveSel(k, `동전 던지기 결과: ${J(keyName(k), "이")} 첫 번째 선택권을 가져갑니다.`); }, { ghost: true })], coinMsg || (history.length ? undefined : "대회 1세트는 시드·성적·추첨으로 정합니다. 수업에서는 직접 지정하거나 동전을 던지세요."))}
                  {selTeam ? (
                    <div className="ui-field fs">
                      <span className="ui-lbl">② {keyName(selTeam)}: 진영 또는 밴픽 순서 중 하나만 고릅니다</span>
                      {mode === "ai" && selTeam === "B" ? <span className="ui-note ai-why">{aiNote}</span> : (
                        <div className="fs-opts">
                          <div className="fs-grp"><span className="fs-k">진영</span>{chip("블루", selWhat === "side" && blueTeam === selTeam, () => holderPick("side", "B"), { color: TEAM.B })}{chip("레드", selWhat === "side" && blueTeam !== null && blueTeam !== selTeam, () => holderPick("side", "R"), { color: TEAM.R })}</div>
                          <div className="fs-grp"><span className="fs-k">밴픽 순서</span>{chip("선픽", selWhat === "order" && firstTeam === selTeam, () => holderPick("order", "F"))}{chip("후픽", selWhat === "order" && firstTeam !== null && firstTeam !== selTeam, () => holderPick("order", "L"))}</div>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {selTeam && selWhat ? field(`③ ${keyName(otherKey(selTeam))}: 남은 ${selWhat === "side" ? "밴픽 순서" : "진영"} 선택`, mode === "ai" && selTeam === "A" ? [<span key="ai" className="ui-note ai-why">{aiNote}</span>] : selWhat === "side"
                    ? [chip("선픽", firstTeam === otherKey(selTeam), () => otherPick("order", "F")), chip("후픽", firstTeam === selTeam, () => otherPick("order", "L"))]
                    : [chip("블루", blueTeam === otherKey(selTeam), () => otherPick("side", "B"), { color: TEAM.B }), chip("레드", blueTeam === selTeam, () => otherPick("side", "R"), { color: TEAM.R })],
                    ready ? `결과: ${keyName(fT)} 선픽 · ${SIDE_KO[fT === bT ? "B" : "R"]} / ${keyName(otherKey(fT))} 후픽 · ${SIDE_KO[fT === bT ? "R" : "B"]}` : undefined) : null}
                  {field("턴 제한 시간", ["15", "20", "30", "45", "60", "0"].map((v: string) => chip(v === "0" ? "무제한" : `${v}초`, timerSec === v, () => setTimerSec(v))))}
                  {field("규칙", [sw("피어리스 드래프트", fearless, setFearless, history.length > 0), sw("5세트 피어리스 해제 (2024 LCK CL 방식)", fear5Off, setFear5Off, !fearless || setNo > 5), sw("프로씬 모드 (누적 2회 밴 시 영구 밴)", proMode, setProMode), sw("빠른 선택 (클릭 즉시 확정)", quick, setQuick)], fearless ? `피어리스: 앞 세트에서 양 팀이 픽한 챔피언은 남은 세트에서 누구도 못 씁니다. 2025~2026 국제대회는 5세트까지 유지${fear5Off ? " · 지금은 5세트에서 해제" : ""}.` : undefined)}
                  <div className="ui-row" style={{ marginTop: 4 }}>
                    {btn(ready ? `SET ${setNo} 밴픽 시작` : !selTeam ? "첫 번째 선택권을 먼저 정해 주세요" : "진영과 밴픽 순서를 모두 정해 주세요", startSet, { big: true, disabled: !ready })}
                    {history.length ? btn("시리즈 전부 초기화", resetAll, { ghost: true }) : null}
                  </div>
                </div>
                <div className="setup-meta">
                  <span className="ui-lbl">2026 {LG.label} 밴픽률 TOP 12 · {NG}경기</span>
                  <div className="meta-grid">
                    {META_TOP.map((c: Champ, idx: number) => (
                      <div key={c.id} className="dl-meta meta" title={`${c.name} · ${proLine(c)}`} style={{ animation: `dlUp .4s ${idx * 40}ms both` }}>
                        <div className="dl-sq-wrap" style={{ borderRadius: 12, boxShadow: `0 0 0 1px ${C.line2}, 0 8px 18px rgba(0,0,0,.45)` }}><Art id={c.id} kind="square" size={52} radius={12} eager /></div>
                        <span className="meta-n">{c.name}</span>
                        <span className="meta-v">{pct(pres(c))}</span>
                      </div>
                    ))}
                  </div>
                  <span className="ui-note">밴픽률 = (픽 + 밴) ÷ {NG}경기</span>
                  <span className="ui-lbl" style={{ marginTop: 8 }}>첫 번째 선택권 가이드</span>
                <div className="fs-guide">
                  <span><b>선픽</b> 1픽으로 가장 강한(OP) 챔피언을 먼저 확보합니다. 대신 마지막 픽은 상대에게 넘어갑니다.</span>
                  <span><b>후픽</b> 1차 픽에서 연속 2픽, 마지막 5픽으로 상대 조합을 모두 본 뒤 카운터할 수 있습니다.</span>
                  <span><b>진영</b> 맵 위치를 정합니다. 드래곤·바론 쪽 동선과 시야, 라인 구도가 달라집니다.</span>
                  <span className="fs-data">데이터: 2026 프로 {NG}경기 블루 진영 승률 {BLUE_PCT} ({BLUE_W}승 {NG - BLUE_W}패). 선픽 팀 승률 {pct(LG.fpW / Math.max(1, LG.fpN))} ({LG.fpW}승 {LG.fpN - LG.fpW}패).</span>
                </div>
                </div>
              </div>
            </div>
          ) : done ? vsPanel() : (
            <Fragment>
              {grid()}
              {coach()}
            </Fragment>
          )}
          {pickCol("R")}
        </div>

        {drafting ? (
          <div className="b-bot">
            {done ? (
              <Fragment>
                <div className="focus hint win-rec">
                  <span>SET {setNo} 결과 기록 <small>(선택 · 진 팀이 다음 세트 첫 번째 선택권)</small></span>
                  <div className="ui-row">{(["A", "B"] as TeamKey[]).map((k: TeamKey) => chip(`${keyName(k)} 승리`, winners[setNo] === k, () => markWin(k)))}</div>
                  {score.A >= 3 || score.B >= 3 ? <span className="win-end">{J(keyName(score.A >= 3 ? "A" : "B"), "이")} 3승으로 시리즈를 가져갔습니다.</span> : null}
                </div>
                <div className="acts">
                  {btn("되돌리기", undo, { ghost: true })}
                  {btn("이번 세트 다시", resetSet, { ghost: true })}
                  {btn("시리즈 초기화", resetAll, { ghost: true })}
                  {btn(setNo >= 5 ? "마지막 세트입니다" : `SET ${setNo + 1} 시작하기`, nextSet, { big: true, color: TEAM.B, disabled: setNo >= 5 })}
                </div>
              </Fragment>
            ) : cur ? (
              <Fragment>
                {focusBox()}
                <div className="opts">
                  <label className="ui-select" title="턴 제한 시간">
                    <span>턴 시간</span>
                    <select value={timerSec} onChange={(e: { target: { value: string } }) => { setTimerSec(e.target.value); setClock({ step: -1, left: 0 }); }}>
                      {["15", "20", "30", "45", "60", "0"].map((v: string) => <option key={v} value={v}>{v === "0" ? "무제한" : `${v}초`}</option>)}
                    </select>
                  </label>
                  {sw("빠른 선택", quick, setQuick)}
                  <div className="tg">
                    <button className={"tg-b" + (learn ? " on" : "")} onClick={() => setLearn(!learn)} title="초보 도움말 켜기/끄기">도움말</button>
                    <button className={"tg-b" + (fx ? " on" : "")} onClick={() => { setFx(!fx); if (!fx) sfx("pick"); }} title="픽·밴 효과음 켜기/끄기">효과음</button>
                    <button className={"tg-b" + (big ? " on" : "")} onClick={() => setBig(!big)} title="강의실 프로젝터용으로 글씨와 그림을 크게">크게 보기</button>
                  </div>
                  {btn("설정", () => setStage("setup"), { ghost: true, cls: "sm" })}
                </div>
                <div className="acts">
                  {btn("되돌리기", undo, { ghost: true, disabled: !acts.length })}
                  {btn("세트 다시", resetSet, { ghost: true, disabled: !acts.length, cls: "hide-s" })}
                  {btn(sel ? `${nameOf(sel)} ${cur.kind === "ban" ? "밴" : "픽"} 확정` : quick ? "클릭하면 바로 확정" : isAISide(cur.side) ? "AI 차례입니다" : "챔피언을 선택하세요", () => confirm(sel), { big: true, color: TEAM[colorOf(cur.side)], disabled: !sel || !humanTurn, cls: "confirm" })}
                </div>
              </Fragment>
            ) : null}
          </div>
        ) : null}
      </div>

      {drafting && done && aB && aR ? (
        <div className="dl analysis dl-fade">
          <div className="an-h"><h2>드래프트 분석</h2><span>데이터 기반 참고 분석 · 승패 예측 아님 · 괄호 안은 표본 수</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                {([["B", aB], ["R", aR]] as [Side, NonNullable<typeof aB>][]).map((pair: [Side, NonNullable<typeof aB>]) => {
                  const s = pair[0];
                  const a = pair[1];
                  const pk = s === "B" ? picksB : picksR;
                  const at = s === "B" ? blueAt : redAt;
                  return (
                    <div key={s} style={{ flex: "1 1 380px", borderRadius: 18, overflow: "hidden", border: `1px solid ${TEAM[s]}44`, background: `linear-gradient(180deg, ${TEAM[s]}1A, ${C.panel} 38%)` }}>
                      <div style={{ position: "relative", height: 190, overflow: "hidden" }}>
                        <div style={{ position: "absolute", inset: 0, display: "flex", gap: 2 }}>
                          {pk.map((id: string) => <div key={id} style={{ position: "relative", flex: 1, overflow: "hidden" }}><Art id={id} kind="loading" /></div>)}
                        </div>
                        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(6,10,17,.2), ${C.panel} 96%)` }} />
                        <div style={{ position: "absolute", left: 18, bottom: 10, right: 18, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontSize: 13, letterSpacing: "0.2em", fontWeight: 800, color: HI[s] }}>{s === "B" ? "BLUE" : "RED"} · {ORD_KO[ordAt(s)]} · {teamOn(s)}</div>
                            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em" }}>{IDN[a.main.k].name} 조합{a.second ? <span style={{ fontSize: 16, color: C.sub, fontWeight: 700 }}> + {IDN[a.second.k].name}</span> : null}</div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 800, padding: "5px 10px", borderRadius: 999, background: "rgba(6,10,17,.7)", border: `1px solid ${C.line2}`, color: C.text }}>{a.tempo}</span>
                        </div>
                      </div>
                      <div style={{ padding: "14px 18px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {ALL_POS.map((p: Pos) => { const id = at[p]; return id ? <div key={p} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 4px", borderRadius: 9, background: C.panel2, border: `1px solid ${C.line}` }}><Art id={id} kind="square" size={26} radius={6} /><PosIcon p={p} size={11} color={HI[s]} /><span style={{ fontSize: 13, color: C.text }}>{nameOf(id)}</span></div> : null; })}
                        </div>
                        <div style={{ fontSize: 13, color: C.sub, lineHeight: "20px" }}>{IDN[a.main.k].desc}</div>
                        {[
                          { h: "승리 플랜", b: IDN[a.main.k].win, col: C.good },
                          { h: "주의할 점", b: IDN[a.main.k].weak, col: C.warn },
                          { h: "파워 스파이크", b: `${a.spike}${a.gdList.length ? ` 라인전 지표 GD@15 (${LG.label}): ${a.gdList.join(", ")}.` : ""}`, col: C.teal },
                        ].map((x: { h: string; b: string; col: string }) => (
                          <div key={x.h} style={{ display: "flex", gap: 10 }}>
                            <span style={{ width: 3, borderRadius: 2, background: x.col, flexShrink: 0 }} />
                            <div><div style={{ fontSize: 13, fontWeight: 800, color: x.col, letterSpacing: "0.04em" }}>{x.h}</div><div style={{ fontSize: 13, color: C.text, lineHeight: "20px", marginTop: 2 }}>{x.b}</div></div>
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {a.checks.map((x: { k: string; v: string; ok: boolean }) => <span key={x.k} style={{ fontSize: 13, padding: "4px 10px", borderRadius: 999, border: `1px solid ${x.ok ? "rgba(52,211,153,.4)" : "rgba(251,191,36,.45)"}`, color: x.ok ? C.good : C.warn, background: x.ok ? "rgba(52,211,153,.08)" : "rgba(251,191,36,.08)" }}>{x.k} {x.v}</span>)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {prio ? (
                <div className="prio">
                  <div className="prio-h"><b>라인 주도권 · 첫 오브젝트</b><span>라인전 지표(GD@15, {LG.label})·챔피언 성향·랭크/프로 상성으로 비교한 참고 분석 · 괄호 안은 표본 수</span></div>
                  {prio.rows.map((r: NonNullable<typeof prio>["rows"][number]) => {
                    const w = sideWord(r.d, 0.6);
                    const pctB = Math.max(8, Math.min(92, 50 + r.d * 12));
                    const evs = (ev: Ev[]) => ev.length ? ev.slice().sort((a: Ev, b: Ev) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 4).map((e: Ev, i: number) => <span key={i} className={"prio-e" + (e.v < 0 ? " neg" : "") + (e.small ? " small" : "")}>{e.t.replace(" · 표본 부족", "")}{e.small ? <em className="b-small">표본 부족</em> : null}</span>) : <span className="prio-e small">근거 데이터 없음 (—)</span>;
                    return (
                      <div key={r.key} className="prio-row">
                        <div className="prio-s">
                          <div className="prio-c">{r.bIds.map((id: string) => <Art key={id} id={id} kind="square" size={34} radius={8} />)}</div>
                          <div className="prio-ev">{evs(r.bEv)}</div>
                        </div>
                        <div className="prio-m">
                          <span className="prio-l">{r.key === "BOT" ? "바텀 (원딜+서폿)" : POS_KO[r.ps[0]]}</span>
                          <div className="prio-bar"><i style={{ width: `${pctB}%` }} /></div>
                          <span className="prio-v" style={{ color: w ? HI[w] : C.sub }}>{w ? `${SIDE_KO[w]} 주도권` : "비슷"}</span>
                        </div>
                        <div className="prio-s r">
                          <div className="prio-c">{r.rIds.map((id: string) => <Art key={id} id={id} kind="square" size={34} radius={8} />)}</div>
                          <div className="prio-ev">{evs(r.rEv)}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="prio-row">
                    <div className="prio-s"><div className="prio-ev"><span className="prio-e">{prio.jbTxt}</span></div></div>
                    <div className="prio-m"><span className="prio-l">정글 선취율</span></div>
                    <div className="prio-s r"><div className="prio-ev"><span className="prio-e">{prio.jrTxt}</span></div></div>
                  </div>
                  <div className="prio-obj">
                    {([["첫 드래곤", prio.drag, prio.dragWhy], ["첫 유충·전령", prio.herald, prio.heraldWhy]] as [string, number, string][]).map((o: [string, number, string]) => {
                      const w = sideWord(o[1], 0.6);
                      return <div key={o[0]} className="prio-o" style={{ borderColor: w ? `${TEAM[w]}88` : C.line2 }}><b>{o[0]}</b><span style={{ color: w ? HI[w] : C.sub }}>{w ? `${SIDE_KO[w]} 유리` : "비슷 — 정글 동선 싸움"}</span><small>{o[2]}</small></div>;
                    })}
                  </div>
                </div>
              ) : null}
              <div style={{ borderRadius: 18, border: "1px solid rgba(45,212,191,.28)", background: "linear-gradient(180deg, rgba(45,212,191,.07), rgba(11,17,27,.9))", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>코칭 포인트</span>
                {points.map((p: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ width: 22, height: 22, borderRadius: 11, background: "rgba(45,212,191,.16)", color: C.teal, fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 13.5, lineHeight: "21px", color: C.text }}>{p}</span>
                  </div>
                ))}
              </div>
        </div>
      ) : null}

      {drafting && done ? (
        <Section heading="코치 노트" caption="수업 토론용 밴픽 순서 기록과 질문">
          <NumberedList items={logLines} />
          <Section heading="토론 질문">
            <NumberedList items={questions} />
          </Section>
        </Section>
      ) : null}

      {history.length ? (
        <Section heading="이전 세트 기록">
          <div className="dl" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((h: SetRecord) => {
              const ho = (sd: Side): Ord => (h.firstSide === sd ? "F" : "L");
              const pk = (sd: Side): string[] => { const o: string[] = []; h.acts.forEach((a: Act, i: number) => { if (STEPS[i].side === ho(sd) && STEPS[i].kind === "pick") o.push(a.id); }); return o; };
              const bn = (sd: Side): string[] => { const o: string[] = []; h.acts.forEach((a: Act, i: number) => { if (STEPS[i].side === ho(sd) && STEPS[i].kind === "ban" && a.id !== "NONE") o.push(a.id); }); return o; };
              const hw = winners[h.no];
              const wTag = (k: TeamKey) => hw === k ? <em className="win-b">승리</em> : null;
              return (
                <div key={h.no} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "12px 16px", borderRadius: 14, background: `linear-gradient(90deg, ${TEAM.B}1F, #0B111B 30%, #0B111B 70%, ${TEAM.R}1F)`, border: `1px solid ${C.line}`, color: C.text }}>
                  <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.16em", color: C.teal, minWidth: 50 }}>SET {h.no}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 260px", minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: HI.B }}>{h.blueName} · 블루 · {ORD_KO[ho("B")]}{wTag(h.blueKey)}</span>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                      {pk("B").map((id: string) => <div key={id} title={nameOf(id)}><Art id={id} kind="square" size={36} radius={8} /></div>)}
                      <span style={{ width: 1, height: 22, background: C.line, margin: "0 4px" }} />
                      {bn("B").map((id: string) => <div key={id} title={`밴: ${nameOf(id)}`} style={{ filter: "grayscale(1) brightness(.7)" }}><Art id={id} kind="square" size={24} radius={5} /></div>)}
                    </div>
                    <span style={{ fontSize: 13, color: C.dim }}>{pk("B").map(nameOf).join(" · ")}</span>
                  </div>
                  <span style={{ fontSize: 13, color: C.dim, fontWeight: 900, letterSpacing: "0.22em" }}>VS</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 260px", minWidth: 0, alignItems: "flex-end", textAlign: "right" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: HI.R }}>{wTag(otherKey(h.blueKey))}{ORD_KO[ho("R")]} · 레드 · {h.redName}</span>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
                      {bn("R").map((id: string) => <div key={id} title={`밴: ${nameOf(id)}`} style={{ filter: "grayscale(1) brightness(.7)" }}><Art id={id} kind="square" size={24} radius={5} /></div>)}
                      <span style={{ width: 1, height: 22, background: C.line, margin: "0 4px" }} />
                      {pk("R").map((id: string) => <div key={id} title={nameOf(id)}><Art id={id} kind="square" size={36} radius={8} /></div>)}
                    </div>
                    <span style={{ fontSize: 13, color: C.dim }}>{pk("R").map(nameOf).join(" · ")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      <Section heading="밴픽 기초 설명" collapsible defaultOpen={false}>
        <Steps steps={[
          { title: "첫 번째 선택권 (2026~)", detail: `선택권을 가진 팀이 진영(블루/레드) 또는 밴픽 순서(선픽/후픽) 중 하나를 고르고, 상대 팀이 남은 하나를 고릅니다. 그래서 레드 진영도 선픽을 할 수 있습니다. 1세트는 시드·성적·추첨으로, 2세트부터는 이전 세트에서 진 팀이 선택권을 갖습니다. 2026 프로 ${NG}경기 블루 진영 승률은 ${BLUE_PCT}입니다(선픽 팀 승률 ${pct(LG.fpW / Math.max(1, LG.fpN))}, ${LG.fpN}경기).` },
          { title: "1차 밴 (선픽·후픽 팀 번갈아 3개씩)", detail: "선픽 → 후픽 → 선픽 → 후픽 → 선픽 → 후픽. 가장 강한 챔피언이나 상대의 주력 챔피언을 지웁니다." },
          { title: "1차 픽 (선픽1 · 후픽2 · 선픽2 · 후픽1)", detail: "선픽 팀 1픽, 후픽 팀 연속 2픽, 선픽 팀 연속 2픽, 후픽 팀 3픽. 조합의 뼈대를 세우는 구간입니다." },
          { title: "2차 밴 (후픽 팀부터 번갈아 2개씩)", detail: "후픽 → 선픽 → 후픽 → 선픽. 상대가 채우지 못한 포지션을 겨냥하는 '타겟 밴'이 핵심입니다." },
          { title: "2차 픽 (후픽1 · 선픽2 · 후픽1)", detail: "후픽 팀 4픽, 선픽 팀 연속 4·5픽, 마지막으로 후픽 5픽(마지막 픽). 부족한 역할을 채우고 마지막 카운터픽으로 마무리합니다." },
        ]} />
        <Properties items={[
          { label: "픽 순서가 중요한 이유", value: "먼저 고르는 팀은 강한 챔피언을 확보하지만 정보를 먼저 보여 줍니다. 나중에 고르는 팀은 상대를 보고 대응할 수 있습니다." },
          { label: "카운터픽", value: "상대 챔피언을 보고 그 챔피언에게 강한 챔피언을 고르는 것입니다. 라인 상대가 정해지기 쉬운 포지션은 뒤로 미루기도 합니다." },
          { label: "블라인드 픽", value: "상대 라이너가 공개되기 전에 고르는 픽입니다. 카운터당해도 크게 무너지지 않는 안정적인 챔피언이 좋습니다." },
          { label: "플렉스 픽", value: "두 개 이상의 포지션에 갈 수 있는 챔피언입니다. 일찍 뽑으면 상대가 어느 라인에 쓸지 몰라 카운터하기 어렵습니다." },
          { label: "피어리스 규칙", value: "여러 세트로 진행되는 경기에서, 앞 세트에 양 팀이 픽한 챔피언은 남은 세트에서 누구도 다시 고를 수 없습니다(하드 피어리스). 밴은 다음 세트로 이어지지 않습니다. 2025~2026 국제대회는 5세트까지 잠금을 유지합니다." },
          { label: "진영과 순서", value: "블루/레드는 맵 위치, 선픽/후픽은 밴픽 순서입니다. 2025년까지는 블루가 늘 선픽이었지만 2026년부터는 둘을 따로 정합니다. 화면의 팀 색은 진영 기준이고, '선픽 · 레드'처럼 두 정보를 함께 표시합니다." },
        ]} />
      </Section>

      <Section heading="데이터 출처와 계산 방법" collapsible defaultOpen={false}>
        <Properties items={[
          { label: "경기 범위", value: `${LG.desc} ${NG}경기(${LG.from}~${LG.to}), 패치 ${LG.patches}. '최근 패치'는 최근 6패치(${LG.recent}) ${NR}경기입니다. 설정 화면에서 리그를 바꾸면 모든 프로 수치가 그 리그 기준으로 바뀝니다.` },
          { label: "원천", value: "Oracle's Elixir(oracleselixir.com)가 분석가·팬용으로 무료 공개하는 2026 경기 표입니다(하루 1회 갱신, 이 사이트 집계일 " + PRO_MADE + "). 경기 통계는 Riot Games 소유이며 Riot 정책을 따릅니다. 선수·팀 이름은 쓰지 않고 챔피언 통계만 씁니다." },
          { label: "랭크 상성", value: `Riot Games API(MATCH-V5)로 직접 모은 한국 서버 솔로 랭크 경기입니다(티어 ${tierTxt(LP_META)} ${rkN(LP_META.games)}경기, 패치 ${LP_META.patch}, 수집일 ${LP_META.collectedAt}, ${LP_META.champions}개 챔피언 · ${LP_META.entries}개 챔피언-라인, 라인 비율 5% 이상·20판 이상). 경기의 티어는 그 경기를 찾게 된 선수의 티어(마스터 + = 챌린저·그랜드마스터·마스터)입니다. 같은 라인 맞대결은 5판 이상만 저장하고, ${RK_MIN}판 미만은 상성 점수·추천 근거·분석 문장에서 빼고 상성 탭에서도 접힌 '표본 부족 (참고)'로만 보여 줍니다. ${RK_MIN}~99판은 '표본 부족' 표시와 함께 씁니다. 상성 점수에는 랭크 승률을 (승률×판수 + 50%×200)/(판수+200)으로 보정해 주 근거로 쓰고, 프로 맞대결은 10경기 이상일 때만 보조 근거로 더합니다. 소환사 이름·Riot ID 등 개인 정보는 저장하지 않습니다.` },
          { label: "포지션", value: "Riot 경기 데이터의 참가자 슬롯 순서(탑·정글·미드·원딜·서폿)로 판정했습니다. 대회 기용이 적은 챔피언은 일반 게임 기준 추정 포지션입니다." },
          { label: "승률 보정", value: "챔피언 승률은 (승+10)/(경기+20), 상성·시너지는 (승+3)/(경기+6)로 50% 쪽으로 당겨 소표본 과대평가를 줄였습니다. 화면에는 10경기 이상이면 승률과 표본 수를, 10경기 미만이면 승률 대신 'n승 m패 · 표본 부족'으로 표시합니다." },
          { label: "포지션 티어", value: `포지션별 기용 수로 픽을 나누고, 밴은 그 챔피언의 포지션 비중만큼 나눠 포지션 밴픽률을 구했습니다(최근 패치 ${NR}경기 60% + 시즌 40%, 최근 패치의 포지션 비중은 시즌 비중으로 근사). 여기에 포지션 승률을 (승+10)/(기용+20)으로 보정해 더한 점수로, 기용 5경기 이상 챔피언을 상위 10%=S, 다음 20%=A, 다음 30%=B, 나머지=C로 나눴습니다. 5경기 미만은 '표본 부족'으로 따로 둡니다.` },
          { label: "정글 점수", value: "① 정글-미드·정글-서폿 동반 승률(3경기 이상, 다른 조합보다 1.5배 가중) ② 정글로 기용된 경기에서 팀의 퍼블·첫 드래곤·유충 우세·첫 전령 선취율((선취+5)/(경기+10)으로 보정)/(경기+10)으로 보정) ③ 정글 GD@15·XPD@15(Oracle's Elixir 지표, 선택한 리그) ④ 상대 라이너와 만난 경기 승률(교차 매치업, 3경기 이상, 보정). 정글 CSD@15는 확정 지표에 있지만 점수가 GD·XPD와 겹쳐 반영하지 않았고, 갱킹 횟수·정글 동선·와드 위치는 타임라인 데이터가 없어 쓰지 않았습니다(—)." },
          { label: "GD@15", value: "선택한 리그에서 그 챔피언을 쓴 선수의 15분 골드 차이(같은 포지션 상대 대비)를 평균했습니다. 10경기 미만은 '표본 부족'입니다." },
          { label: "챔피언 특성", value: "피해 유형·내구·CC·기동은 Riot 클라이언트 데이터(Community Dragon), 이미지는 Data Dragon 16.22.1입니다." },
          { label: "한계", value: "랭크 상성은 챔피언·라인별 상위 5명씩만 공개되어 대부분의 매치업은 비어 있고, 일반 랭크와 프로 무대의 상성은 다를 수 있습니다. 프로 상성·시너지 표본은 대부분 수 경기~수십 경기입니다. 선수 숙련도, 패치별 변화, 팀 전략은 반영하지 않으며 모든 분석은 참고용입니다." },
        ]} />
      </Section>
    </Page>
  );
}