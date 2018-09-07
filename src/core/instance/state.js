/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

/*为对象的属性添加拦截器*/
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  vm._watchers = [] //用来存放watcher实例的
  const opts = vm.$options //父子组件通信用的数据
  if (opts.props/*当前组件的props*/) initProps(vm, opts.props) //父组件传的和子组件想要接收的数据对比
  if (opts.methods) initMethods(vm, opts.methods)//初始化组件的methods
  /*初始化data*/
  if (opts.data) { //存在data初始化组件的data
    initData(vm)
  } else {//没有就添加空对象
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed) //初始化组件的Computed
  //初始化watch(判断vm.$options.watch ！== undefined)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

/*作用: 初始化组件的props,并设置默认值, 与vue保留的字段名冲突给予警告*/
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {} /*父组件传递的props*/
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent //判断是否是根组件
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false) //设置shouldObserve为false
  }
  /*propsOptions在这个时候已经全部转成固定的对象格式了*/
  for (const key in propsOptions) { //循环子组件接收的想要的通信数据的key(子组件随意订的)
    keys.push(key)
    //处理父子组件需要通信的值进行验证处理和默认值处理并输出
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      //将key解析成kebab-case写法
      const hyphenatedKey = hyphenate(key)
      //与vue保留变量名冲突的键名给予提示
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (vm.$parent && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    /*如果key值不在实例上则在实例上为_props添加拦截器并把key添加到_props*/
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  /*将shouldObserve设置为true*/
  toggleObserving(true)
}
/*作用: 初始化组件的data,并检测是否与参数中的props和methods冲突*/
function initData (vm: Component) {
  //取出参数中的data
  let data = vm.$options.data

  data = vm._data = typeof data === 'function'
    ? getData(data, vm) //获取生产模式函数的返回值
    : data || {}
  //data不为对象时报错警告
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data) //获取参数data的key
  const props = vm.$options.props //获取参数data的props
  const methods = vm.$options.methods //获取参数data的的methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      /*data中的属性名与方法名冲突报错警告*/
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    /*data中的属性名与props中的属性冲突报错警告*/
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      //属性名的第一个字符不是$或者_时为实例添加_data属性并为其添加拦截器
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  /*为data添加observe实例以便响应式*/
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget() //Dep.target设置为undefined
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { computed: true }

/*---------------------------------- computed--------------------------------------------------------*/
/*初始化Computed并提示错误参数的警告*/
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  //创建一个原型为空的空对象
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering() //判断是不是服务端渲染

  for (const key in computed) {
    const userDef = computed[key]
    //获取get方法
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    //getter为空提示警告
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      //生成Watcher实例
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    //没有定义在实例上,添加描述符(拦截器)并提示警告错误情况
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      /*提示与props和data中的key值冲突的警告*/
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

/**
   作用: 为计算属性在不同的端运行时，为key添加key设置的get、set方法或新的get方法(兼容各端)
    最后设置拦截器
 **/
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()//判断是否是服务端渲染
  /*key的值是function*/
  if (typeof userDef === 'function') {
    /*
      服务端: 创建一个新的get方法，只不过输出的默认值还是参数get方法的默认值
      不是服务端: 参数get方法
    */
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : userDef
    sharedPropertyDefinition.set = noop //空方法
  } else {
    /*和key的值是function的时候的处理一样*/
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false //(cache将被弃用 作用:计算属性的缓存验证)
        ? createComputedGetter(key)
        : userDef.get
      : noop
    /*设置了就取key的get，没有就是赋值一个空方法*/
    sharedPropertyDefinition.set = userDef.set
      ? userDef.set
      : noop
  }
  /*如果不为生产环境没有设置key的set方法,那么在改变key的值时将报警告*/
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  /*为key添加拦截器*/
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/**
  创建一个新的get方法(只对在服务端渲染的计算属性computed)
  前提执行这个方法前，必须在实例的_computedWatchers对象中定义过这个key
**/
function createComputedGetter (key) {
  return function computedGetter () {
    //判断是否在_computedWatchers中定义过
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      watcher.depend() //将这个watcher实例添加进subs中
      return watcher.evaluate() //执行computed[key]方法
    }
  }
}
/*-------------------------------------------------------------------------------------------------*/
/*初始化参数中的methods并且添加到实例上*/
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props //获取参数的props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (methods[key] == null) {
        warn(
          `Method "${key}" has an undefined value in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      //方法名与props的key名字冲突
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      //方法名存在实例中&&方法名的第一个字符是$或者_时报警告
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    /*参数中的方法是否为空？
        空: 新的方法  不为空: 返回this指向实例的methods[key]
      并且将属性添加到实例上
    */
    vm[key] = methods[key] == null ? noop : bind(methods[key], vm)
  }
}

function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    //数组形式的key值
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}
/*作用: 处理各种形式的wantch参数*/
function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  //判断key值是否是对象形式的
  if (isPlainObject(handler)) {
    options = handler //key对应的值
    handler = handler.handler //值改变后要执行的方法
  }
  //判断key值是否是字符串形式的
  if (typeof handler === 'string') {
    handler = vm[handler] //将methods中的方法赋值给key
  }
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  /*设置一个输出值是data对象并且名为get的方法*/
  dataDef.get = function () { return this._data }
  const propsDef = {}
  /*设置一个输出值是props对象并且名为get的方法*/
  propsDef.get = function () { return this._props }
  /*当出现改变实例data属性时或props属性时提示错误警告*/
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function (newData: Object) {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  /*为$data和$props添加读取和赋值的拦截器*/
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) {
      cb.call(vm, watcher.value)
    }
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
