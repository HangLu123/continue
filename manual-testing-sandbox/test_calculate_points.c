#include "unity.h"
#include "cmock.h"
#include "calculate_points.h"

// Mock definition for external dependency
int __wrap_query_points_multiplier(user_level_t level);

void setUp(void) {}
void tearDown(void) {}

// Test case: Invalid amount (negative)
void calculate_points_whenAmountIsNegative_shouldReturnMinusOne(void) {
    // given
    user_level_t level = USER_LEVEL_NORMAL;
    int amount = -5;

    // when
    int result = calculate_points(level, amount);

    // then
    TEST_ASSERT_EQUAL(-1, result);
}

// Test case: Invalid user level
void calculate_points_whenLevelIsInvalid_shouldReturnMinusOne(void) {
    // given
    user_level_t level = 3; // Invalid level
    int amount = 10;

    // when
    int result = calculate_points(level, amount);

    // then
    TEST_ASSERT_EQUAL(-1, result);
}

// Test case: Valid parameters but multiplier returns 0
void calculate_points_whenMultiplierIsZero_shouldReturnMinusTwo(void) {
    // given
    user_level_t level = USER_LEVEL_VIP;
    int amount = 100;
    
    // Setup mock
    __wrap_query_points_multiplier_ExpectAndReturn(level, 0);

    // when
    int result = calculate_points(level, amount);

    // then
    TEST_ASSERT_EQUAL(-2, result);
}

// Test case: Valid scenario with correct calculation
void calculate_points_whenValidInputs_shouldCalculateCorrectly(void) {
    // given
    user_level_t level = USER_LEVEL_SVIP;
    int amount = 50;
    
    // Setup mock
    __wrap_query_points_multiplier_ExpectAndReturn(level, 3);

    // when
    int result = calculate_points(level, amount);

    // then
    TEST_ASSERT_EQUAL(150, result);
}

int main(void) {
    UNITY_BEGIN();
    RUN_TEST(calculate_points_whenAmountIsNegative_shouldReturnMinusOne);
    RUN_TEST(calculate_points_whenLevelIsInvalid_shouldReturnMinusOne);
    RUN_TEST(calculate_points_whenMultiplierIsZero_shouldReturnMinusTwo);
    RUN_TEST(calculate_points_whenValidInputs_shouldCalculateCorrectly);
    return UNITY_END();
}