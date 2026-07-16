import { observable, action } from 'mobx-miniprogram'

export const counterStore = observable({
  /** 计数值 */
  count: 0,

  /** 计算属性：是否为偶数 */
  get isEven() {
    return this.count % 2 === 0
  },

  /** 加 1 */
  increment: action(function () {
    this.count += 1
  }),

  /** 减 1 */
  decrement: action(function () {
    this.count -= 1
  }),

  /** 重置为 0 */
  reset: action(function () {
    this.count = 0
  })
})
