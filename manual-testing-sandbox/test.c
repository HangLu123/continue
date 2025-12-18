#include "points_calculator.h"

/* =========================
 * 外部依赖（需要在测试中 mock）
 * ========================= */

/**
 * 查询积分倍率
 * 返回值：
 *  >0  倍率
 *  -1  查询失败
 */
int query_points_multiplier(user_level_t level);

/* =========================
 * 被测函数实现
 * ========================= */

int calculate_points(user_level_t level, int amount)
{
    int multiplier;

    /* 参数校验 */
    if (amount < 0) {
        return -1;
    }

    if (level != USER_LEVEL_NORMAL &&
        level != USER_LEVEL_VIP &&
        level != USER_LEVEL_SVIP) {
        return -1;
    }

    /* 调用外部依赖 */
    multiplier = query_points_multiplier(level);
    if (multiplier <= 0) {
        return -2;
    }

    /* 计算积分 */
    return amount * multiplier;
}
