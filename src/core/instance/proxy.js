/* not type checking this file because flow doesn't play well with Proxy */

import config from 'core/config'
import { warn, makeMap, isNative } from '../util/index'

let initProxy

if (process.env.NODE_ENV !== 'production') {
  const allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
    'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
    'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,' +
    'require' // for Webpack/Browserify
  )
  //错误提示
  const warnNonPresent = (target, key) => {
    warn(
      `Property or method "${key}" is not defined on the instance but ` +
      'referenced during render. Make sure that this property is reactive, ' +
      'either in the data option, or for class-based components, by ' +
      'initializing the property. ' +
      'See: https://vuejs.org/v2/guide/reactivity.html#Declaring-Reactive-Properties.',
      target
    )
  }
  //判断是否支持ES6的Proxy或存在Proxy函数
  const hasProxy =
    typeof Proxy !== 'undefined' && isNative(Proxy)
  //支持ES6的Proxy或存在Proxy函数
  if (hasProxy) {
    //缓存一个判断参数是否存在于下面参数中的函数
    const isBuiltInModifier = makeMap('stop,prevent,self,ctrl,shift,alt,meta,exact')
    /*为config.keyCodes添加代理，当设置为上面几个时报错*/
    config.keyCodes = new Proxy(config.keyCodes, {
      set (target, key, value) {
        if (isBuiltInModifier(key)) {
          warn(`Avoid overwriting built-in modifier in config.keyCodes: .${key}`)
          return false
        } else {
          target[key] = value
          return true
        }
      }
    })
  }

  //添加for in 循环时的拦截
  const hasHandler = {
    //拦截key in target的操作，返回一个布尔值
    has (target, key) {
      const has = key in target //是否存在与目标中
      //判断key名是否存在于allowedGlobals函数中生成的对象中 || (key名是string类型 && 首字母是_)
      const isAllowed = allowedGlobals(key) || (typeof key === 'string' && key.charAt(0) === '_')
      //访问了一个没有定义在实例对象上(或原型链上)的属性 && isAllowed为false提示警告
      if (!has && !isAllowed) {
        warnNonPresent(target, key)
      }
      //返回一个布尔值
      return has || !isAllowed
    }
  }
  //为当前组件实例添加拦截（不存在实例中将报错）
  //添加读取属性拦截
  const getHandler = {
    get (target, key) {
      //key名是字符串类型 && key不存在于目标中提示警告
      if (typeof key === 'string' && !(key in target)) {
        warnNonPresent(target, key)
      }
      return target[key]
    }
  }

  initProxy = function initProxy (vm) {
    //支持Proxy
    if (hasProxy) {
      // determine which proxy handler to use
      //缓存合并选项后的vm.$options
      const options = vm.$options
      //_withStripped这个属性只在测试代码中出现过所以一般为false,也就是赋值为hasHandler
      const handlers = options.render && options.render._withStripped
        ? getHandler
        : hasHandler
      //为vm实例添加代理,对以下情况时进行拦截
      /*
        1、属性查询: foo in proxy
        2、继承属性查询: foo in Object.create(proxy)
        3、with 检查: with(proxy) { (foo); }
        4、Reflect.has()
      */
      vm._renderProxy = new Proxy(vm, handlers)
    } else {
      vm._renderProxy = vm
    }
  }
}

export { initProxy }
