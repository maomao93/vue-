import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

//为Vue原型添加_init方法
initMixin(Vue)
/*为$data，$props添加拦截器来提示一些警告(这些时只读属性)
初始化一些有关state的方法比如：$set、$delete、$watch*/
stateMixin(Vue)
/*为Vue原型添加$on、$once、$off、$emit四个方法*/
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
