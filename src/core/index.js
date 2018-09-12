import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'

//为Vue添加全局API
initGlobalAPI(Vue)

//为vue原型添加只读属性$isServer,判断是vue运行在客户端还是服务端
Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})
//为vue原型添加只读属性$ssrContext
Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// expose FunctionalRenderContext for ssr runtime helper installation
//为vue原型添加属性FunctionalRenderContext,为服务端渲染准备的(ssr)
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

//vue版本号,rollup 的 replace 插件会把'__VERSION__'替换成版本号
Vue.version = '__VERSION__'

export default Vue
