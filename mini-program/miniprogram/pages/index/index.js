import { createStoreBindings } from 'mobx-miniprogram-bindings'
import { counterStore } from '../../stores/index'

Page({
  onLoad() {
    // Page 级 store 绑定：在 onLoad 中创建
    this.storeBindings = createStoreBindings(this, {
      store: counterStore,
      fields: {
        // 字符串映射：将 store 的 count 映射到页面 data.count
        count: 'count',
        // 函数映射：自定义计算逻辑
        isEven: () => counterStore.isEven
      },
      actions: {
        // 将 store action 映射为页面方法
        increment: 'increment',
        decrement: 'decrement',
        reset: 'reset'
      }
    })
  },

  onUnload() {
    // 销毁 store 绑定，防止内存泄漏
    this.storeBindings.destroyStoreBindings()
  }
})
