# 素材来源

- 网页素材统一从 ImageKit 的 `/teachers-day/teachers-day-imagekit-upload.OVeonn/` 目录加载，项目不再保留重复静态副本。
- 音乐：用户提供的 `Carpenters - Top Of The World.mp3`，网页使用 ImageKit 上的 `top-of-the-world.mp3`。
- 专辑封面：Carpenters《A Song for You》官方发布页 https://www.carpentersofficial.com/releases-archive/song-you/ 。原图 https://www.carpentersofficial.com/wp-content/uploads/sites/1757/2018/11/release_201811_39d0e2abfa208542a4c5cdb412aca21d45bc64c0.jpg 。网页使用 ImageKit 上的 `a-song-for-you.jpg`。
- 插画使用内置 image_gen 生成，未使用 CLI 模式。网页使用 ImageKit 上的 `hallway.png`、`door.png`、`envelope.png`。
- 三张插画的生成提示摘要：暖色手绘绘本风格的空办公室门框和走廊，包含盆栽与书本、没有人物文字；透明背景正视蜂蜜木色门板和黄铜把手，不含门框或文字；透明背景、正视、打开的奶油色信封，带桃色折痕与赤陶红蜡封。完整构图要求：走廊 2:3，门框中央发出暖光；门板 1:2、正交视角、把手位于右侧；信封 4:3、上方三角封口完全打开。
- 祝福视频：使用 `config.video.src` 中的 ImageKit 网络地址，项目不保存视频副本。

## 红枣礼盒（2026-09-08）

- 三维枣模型：用户提供的 `hongzao_red_date.glb`，网页使用 ImageKit 上的 `hongzao-red-date.glb`。这是自包含的 GLB 2.0 模型，含果实、枣柄和顶点色，不需要外部纹理；网页展示一颗旋转红枣。
- 礼盒插画：通过内置 `image_gen` 工具生成，非 CLI 模式，网页使用 ImageKit 上的 `jujube-gift.png`。透明背景，上半张是独立盒盖，下半张是仅装一颗红枣的盒身；代码裁切显示并移动盒盖，没有修改用户提供的海报。
- 生成提示：`Use case: illustration-story. Create one clean transparent PNG game sprite sheet for a warm cream, honey wood and muted terracotta Teachers Day interactive storybook website. Square 1024x1024. Two isolated parts of ONE Chinese red dates gift box, a shallow rectangular cream paperboard gift box with terracotta red side band, thin gold edging, delicate paper texture and red silk ribbon. Soft hand-painted gouache watercolor, slightly 3D, polished picture book illustration. Top half of image: ONLY the separate closed lid with beautiful red ribbon bow, centered, front three-quarter view looking down slightly, lid floating isolated, spans x=130 to 894 y=60 to 420. Bottom half: ONLY the matching open box base filled with rich reddish-brown dried Chinese jujube dates sitting in pale cream tissue paper, same scale/perspective, spans x=130 to 894 y=570 to 930. Parts do not overlap. Lots of transparent padding between parts and at edges. The top part will be animated off the bottom part by code. No cast shadow on background, no scenery, no text, no labels, no logo, no border. Genuinely transparent alpha background, not a checkerboard pattern. The front lip of the base clearly visible and opaque.`
- 红枣寓意参考：[北京市教委记录的孔庙和国子监博物馆礼仪体验](https://jw.beijing.gov.cn/language/gqxx/ftq/201810/t20181018_869901.html)，其中红枣寓意“早日高中”。网页只作寓意介绍，没有把六礼的完整固定组合断言为某个朝代的普遍制度；“早些休息、日子甜一点”为这次教师节祝福的原创延伸。
