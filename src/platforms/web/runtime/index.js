/* @flow */
/*
  对vue进行平台化的包装
    1、设置平台化的 Vue.config。
    2、在 Vue.options 上混合了两个指令(directives)，分别是 model 和 show。
    3、在 Vue.options 上混合了两个组件(components)，分别是 Transition 和 TransitionGroup。
    4、在 Vue.prototype 上添加了两个方法：__patch__ 和 $mount。
*/
import Vue from 'core/index'
import config from 'core/config'
import { extend, noop } from 'shared/util'
import { mountComponent } from 'core/instance/lifecycle'
import { devtools, inBrowser, isChrome } from 'core/util/index'

import {
  query,
  mustUseProp,
  isReservedTag,
  isReservedAttr,
  getTagNamespace,
  isUnknownElement
} from 'web/util/index'

import { patch } from './patch'
import platformDirectives from './directives/index'
import platformComponents from './components/index'

// install platform specific utils
Vue.config.mustUseProp = mustUseProp
Vue.config.isReservedTag = isReservedTag
Vue.config.isReservedAttr = isReservedAttr
Vue.config.getTagNamespace = getTagNamespace
Vue.config.isUnknownElement = isUnknownElement

/*这个是执行下面两句代码之前Vue.options = {
  components: {
    KeepAlive
  },
  directives: Object.create(null),
  filters: Object.create(null),
  _base: Vue
}*/
// install platform runtime directives & components
extend(Vue.options.directives, platformDirectives)
extend(Vue.options.components, platformComponents)
/*执行上面两句代码后Vue.options = {
  components: {
    KeepAlive,
    Transition,
    TransitionGroup
  },
  directives: {
    model,
    show
  },
  filters: Object.create(null),
  _base: Vue
}*/

// install platform patch function
/*
   判断是否在浏览器环境运行
    是: patch函数
    否: 空方法
*/
Vue.prototype.__patch__ = inBrowser ? patch : noop

// public mount method
//为vue原型添加$mount方法
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && inBrowser ? query(el) : undefined
  return mountComponent(this, el, hydrating)
}

// devtools global hook
/* istanbul ignore next */
/*
  前提: 运行在浏览器环境下
*/
if (inBrowser) {
  setTimeout(() => {
    //不在生产环境下
    if (config.devtools) {
      if (devtools) {
        devtools.emit('init', Vue)
      } else if (
        process.env.NODE_ENV !== 'production' &&
        process.env.NODE_ENV !== 'test' &&
        isChrome
      ) {
        console[console.info ? 'info' : 'log'](
          'Download the Vue Devtools extension for a better development experience:\n' +
          'https://github.com/vuejs/vue-devtools'
        )
      }
    }
    if (process.env.NODE_ENV !== 'production' &&
      process.env.NODE_ENV !== 'test' &&
      config.productionTip !== false &&
      typeof console !== 'undefined'
    ) {
      console[console.info ? 'info' : 'log'](
        `You are running Vue in development mode.\n` +
        `Make sure to turn on production mode when deploying for production.\n` +
        `See more tips at https://vuejs.org/guide/deployment.html`
      )
    }
  }, 0)
}

export default Vue
