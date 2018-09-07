/* @flow */

import { warn } from './debug'
import { observe, toggleObserving, shouldObserve } from '../observer/index'
import {
  hasOwn,
  isObject,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'
import {type} from "../../../types/options";

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};

/**
 作用: 输出父组件传递的值或处理过的默认值
  1、prop.type存在Boolean类型,
      一、父组件未传递值, 并且未设置默认值, 默认值为false
      二、父组件传递的值为空或者传递的值与将key解析成(kebab-case)写法相同时
          (prop.type不存在String类型)或者(存在String类型但是Boolean类型在前)
          这时的默认值为true
          举例: prop.type:[Boolean,String]
  2、父组件传递的值为undefined或未传递
      一、子组件未设置默认值，默认值为undefined
      二、设置了默认值，输出默认值,
          如果为对象或数组必须用工厂模式的函数return一个数组或对象否则报错警告
          并对输出的这个对象创建Observer实例
  3、不为生产环境 && (只要不是weex或者传递值不为对象或者@binding不在父组件传递的prop的值)
      一、验证(父组件传递的值或者处理过的默认值)是否与子组件prop.type匹配
**/
export function validateProp (
  key: string,//子组件props中的key
  propOptions: Object,//子组件的props
  propsData: Object,//父组件传下来的props
  vm?: Component
): any {
  const prop = propOptions[key] //子组件的prop
  const absent = !hasOwn(propsData, key) //子组件想要的prop父组件是否有传递
  let value = propsData[key] //父组件传递的prop的值
  // boolean casting
  //判断子组件的prop.type是否存在Boolean类型
  const booleanIndex = getTypeIndex(Boolean, prop.type)
  /*当prop.type存在Boolean类型时(这个时候type为数组[Boolean,String])*/
  if (booleanIndex > -1) {
    /*子组件想要的prop父组件没有传递并且子组件的prop没有设置默认值*/
    if (absent && !hasOwn(prop, 'default')) {
      value = false //设置默认值为false
    } else if (value === '' || value === hyphenate(key)) {
      /*父组件传递的prop的值为空或这个值与(将key为驼峰写法时解析成-写法)相同时*/
      //prop设置的默认值和key相同时
      // only cast empty string / same name to boolean if
      // boolean has higher priority
      //判断子组件的prop是否是String类型
      const stringIndex = getTypeIndex(String, prop.type)
      /*不符合String类型或者prop.type中的Boolean类型下标小于String类型时*/
      if (stringIndex < 0 || booleanIndex < stringIndex) {
        value = true
      }
      //总结：(父组件传递的prop的值为空||这个值与key相同时) && type数组为[Boolean,String,...]时
      //默认值设置为true
    }
  }
  // check default value
  //父组件传递的prop的值为undefined并且prop.type不存在Boolean类型
  if (value === undefined) {
    //输出各种情况时的默认值
    value = getPropDefaultValue(vm, prop, key)
    // since the default value is a fresh copy,
    // make sure to observe it.
    const prevShouldObserve = shouldObserve //false
    toggleObserving(true) //设置shouldObserve为true
    observe(value) //为工厂模式函数返回的值生成一个Observer实例，实现响应式
    toggleObserving(prevShouldObserve) //设置shouldObserve为false
  }
  //不为生产环境 && (只要不是weex或者不为对象或者@binding不在父组件传递的prop的值)
  if (
    process.env.NODE_ENV !== 'production' &&
    // skip validation for weex recycle-list child component props
    !(__WEEX__ && isObject(value) && ('@binding' in value))
  ) {
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/**
 * Get the default value of a prop.
 */
/*给子组件的prop设置默认值*/
/** 1、为设置默认值直接返回undefined
    2、类型为对象或数组时，默认值输出必须是函数否则报错
    3、子组件实例存在这个值，并且父组件也传递了只不过为undefined,则返回存在的这个值
    4、类型为对象或数组时，默认值为函数时输出函数返回的值
    5、不符合以上时，输出默认设置的值 **/
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // no default, return undefined
  //子组件未设置默认值，直接设置默认值
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default
  // warn against non-factory defaults for Object & Array
  //默认值为数组或对象时必须是一个函数return一个对象或数组否则警告
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  /*存在子组件实例并且父组件传递了props且包含的这个key === undefined
  && 实例的_prop存在的这个值 !== undefined*/
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  //默认值为函数，并且prop.type为为函数类型时返回函数(也就是Array和Object类型时的默认输出)
  //其他正常输出
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 */
/**
  作用: 验证(父组件传递的值或者处理过的默认值)是否与子组件prop.type匹配
**/
function assertProp (
  prop: PropOptions,
  name: string,
  value: any,
  vm: ?Component,
  absent: boolean
) {
  //prop.required为true并且父组件没有传递这个prop则警告
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }
  //值为空或undefined && 不是必须传递的直接return
  if (value == null && !prop.required) {
    return
  }
  let type = prop.type //获取类型
  let valid = !type || type === true //类型为空或者类型为true
  const expectedTypes = []
  //下面处理的是写了prop.type的(排除了null和undefined)
  if (type) {
    //不为数组时设置type为数组并且默认第一个为prop.type
    if (!Array.isArray(type)) {
      type = [type]
    }
    //循环直到父组件传递的值与子组件prop想要的类型相同
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i])
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }
  //以下是父组件传递的值与子组件prop想要的类型不同时报警告
  //并且提醒子组件想要的类型并结束该方法
  if (!valid) {
    warn(
      `Invalid prop: type check failed for prop "${name}".` +
      ` Expected ${expectedTypes.map(capitalize).join(', ')}` +
      `, got ${toRawType(value)}.`,
      vm
    )
    return
  }
  const validator = prop.validator
  //是否存在自定义验证函数
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/

/** 作用：主要是判断传入的值与想要的类型是否相同，
输出：类型是否相同  prop.type的类型 **/
function assertType (value: any, type: Function): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  const expectedType = getType(type) //判断类型 没传返回''
  //判断是否是simpleCheckRE存在的类型
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value //判断value的类型(处理过的默认值或者父组件传递下来的值)
    valid = t === expectedType.toLowerCase() //判断是否与子组件想要的类型相同
    // for primitive wrapper objects
    //如果父组件传递的值的类型与子组件想要的类型不同并且父组件传递的是对象
    //判断父组件传递的值是否是prop.type的实例(一般都是false)
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  } else {
    valid = value instanceof type
  }
  return {
    valid,
    expectedType
  }
}

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
/*取出传递值的类型*/
function getType (fn) {
  const match = fn && fn.toString().match(/^\s*function (\w+)/)//匹配()中的并获取这一匹配
  return match ? match[1] : '' //match[1]中放的是类型与上面的()里面有关系
}

/*判断子组件prop.type是否是[type:根据传递的类型]类型*/
function isSameType (a, b) {
  return getType(a) === getType(b)
}

/*用来判断是否为[type:根据传递的类型]类型的(不符合返回-1 符合返回大于-1的值)*/
function getTypeIndex (type, expectedTypes): number {
  if (!Array.isArray(expectedTypes)) {//判断子组件的prop中的type是否接收多类型[]
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  //循环，子组件的prop.type是否要[type:根据传递的类型]类型
  for (let i = 0, len = expectedTypes.length; i < len; i++) {
    if (isSameType(expectedTypes[i], type)) {
      return i
    }
  }
  return -1
}
