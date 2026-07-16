import { storeBindingsBehavior } from 'mobx-miniprogram-bindings'
import { counterStore } from '../../stores/index'

Component({
  behaviors: [storeBindingsBehavior],

  /**
   * Component 级 store 绑定：通过 storeBindings 配置项声明
   * 无需手动创建和销毁，behavior 自动管理生命周期
   */
  storeBindings: {
    store: counterStore,
    fields: {
      // 字符串映射
      count: 'count',
      // 函数映射
      isEven: () => counterStore.isEven
    },
    actions: {
      increment: 'increment',
      decrement: 'decrement'
    }
  }
})
