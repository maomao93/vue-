/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

//为vue添加静态方法extend
export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * 每个实例构造函数，包括Vue，都有唯一的
   * cid. This enables us to create wrapped "child
   * cid。这使我们能够创建包装的“子元素”
   * constructors" for prototypal inheritance and cache them.
   * 用于原型继承并缓存它们的构造函数。
   */
  //为vue添加cid静态属性
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   */
  /*
      作用:
          1、生成VueComponent构造函数
          2、继承并合并当前组件的构造函数的(属性、options)为该构造函数的属性
          3、将该构造函数输出
  */
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {}
    const Super = this//获取实例
    const SuperId = Super.cid//获取当前组件构造函数的标识符
    // 缓存参数的构造函数 || 空对象
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    // 判断参数的构造函数是否为当前组件构造函数，是则直接输出该构造函数(表示都继承自根构造函数)
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }
    // 获取参数的构造函数名或当前组件构造函数名
    const name = extendOptions.name || Super.options.name
    // 在非生产环境下&&存在名字时,与原html标签名冲突或不规范名称给予警告提示
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name)
    }
    // 设置vue组件构造函数(用途:构建vue实例)
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    // 创建原型链为当前组件原型的原型对象
    Sub.prototype = Object.create(Super.prototype)
    // 设置sub函数原型的构造函数为自身(原先是当前组件的构造函数)
    Sub.prototype.constructor = Sub
    // 设置唯一标识符
    Sub.cid = cid++
    // 合并默认的一些option,并且格式化option中的一些属性，使其符合要求，并对不合理的警告提示
    // 合并当前组件的option对象和参数,并且格式化合并过后的option中的一些属性，使其符合要求，并对不合理的警告提示
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    // 设置super属性为当前组件的构造函数(表示继承自该构造函数)
    Sub['super'] = Super

    /*
      * For props and computed properties, we define the proxy getters on
      * 对于props和computed，我们定义代理getter
      * the Vue instances at extension time, on the extended prototype. This
      * 在扩展原型上的扩展时的Vue实例
      * avoids Object.defineProperty calls for each instance created.
      * 这避免为创建的每个实例调用Object.defineProperty
    */
    //存在props时,初始化props
    if (Sub.options.props) {
      initProps(Sub)
    }
    //存在computed时,初始化computed
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
    // 设置该构造函数的继承函数为(当前组件构造函数 || Vue)的构造函数构造器
    Sub.extend = Super.extend
    // 设置该构造函数的混淆为(当前组件构造函数 || Vue)的混淆
    Sub.mixin = Super.mixin
    // 设置该构造函数的混淆为(当前组件构造函数 || Vue)的插件生成器
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    /*const ASSET_TYPES = [
      'component',
      'directive',
      'filter'
    ]*/
    // 设置构造函数的三个属性继承(当前组件构造函数 || Vue)的三个属性
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
    //当前组件构造函数名时,设置该构造函数的参数components的当前组件构造函数名为该构造函数
    if (name) {
      Sub.options.components[name] = Sub
    }
    /*
        keep a reference to the super options at extension time.
        在扩展时保留对超级选项的引用
        later at instantiation we can check if Super's options have
        稍后在实例化时，我们可以检查Super的选项是否具有更新
        been updated.
    */
    // 设置该构造函数superOptions属性继承为当前组件构造函数的options
    Sub.superOptions = Super.options
    // 设置该构造函数extendOptions属性为构造器传入的参数
    Sub.extendOptions = extendOptions
    // 将当前组件构造函数的options和构造器传入的参数合并的option拷贝一份为sealedOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    // 缓存构造函数,设置传入参数的_Ctor[当前组件构造函数的标识符]为该构造函数
    cachedCtors[SuperId] = Sub
    // 将该构造函数输出
    return Sub
  }
}
/*
    作用:
          1、循环参数的props对象，并为其原型添加代理,读取和设置该props中的属性时是读取和设置
            _props的属性值
*/
function initProps (Comp) {
  // 缓存props参数
  const props = Comp.options.props
  // 循环props,为构造函数原型添加代理,当读取原型中的属性值时获取实例中_props对象中的属性值
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}
/*
  作用:
        1、为参数的原型中的key属性添加代理
*/
function initComputed (Comp) {
  // 获取computed对象
  const computed = Comp.options.computed
  // 循环computed对象中的key
  for (const key in computed) {
    // 为构造函数的原型中的key属性添加代理
    defineComputed(Comp.prototype, key, computed[key])
  }
}
