/**
 * 商品 / 餐食疗程 / 补剂排期：服务结构锁定时的说明与交互文案（与商品编辑横幅风格一致）
 */

/** 与 ProductForm 顶部黄条一致 */
export const PRODUCT_SERVICE_STRUCTURE_BANNER =
  '该商品存在进行中的已支付订单，已锁定「时长/餐食计划/补剂疗程」。可继续修改价格、名称、描述等信息。';

/** 餐食疗程表单（对齐商品：说清锁什么、还能改什么） */
export const MEAL_PLAN_SERVICE_STRUCTURE_BANNER =
  '该餐食疗程仍有进行中的已支付订单在使用，已锁定「疗程天数、每天餐次」等结构。可继续修改名称、描述或启用状态。';

/** 补剂疗程表单 */
export const SUPPLEMENT_SCHEDULE_SERVICE_STRUCTURE_BANNER =
  '该补剂疗程仍有进行中的已支付订单在使用，已锁定「总天数、阶段与补剂内容」。可继续修改疗程名称。';

/** 删除整表仍禁止时（后端也会 400） */
export const ENTITY_DELETE_BLOCKED_IN_SERVICE =
  '仍有进行中的已支付订单在使用，无法删除该配置。';

/** 列表/卡片角标：与商品「有进行中订单」同类，便于未打开表单即可识别 */
export const LIST_SERVICE_STRUCTURE_LOCKED_BADGE = '服务结构锁定';
