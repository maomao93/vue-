/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype //数组构造函数的原型
export const arrayMethods = Object.create(arrayProto)//创建原型为数组原型的空对象

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  /*['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse']*/
  //获取数组原型上的这几个方法并缓存
  const original = arrayProto[method]
  //为原型为数组原型的空数组上添加这个几个属性，定义这些属性为不可枚举，并且值为一个方法(相当于为数组方法添加一层拦截)
  def(arrayMethods, method, function mutator (...args) {
    //将参数传进原数组方法的push等方法，并获取返回的值(将方法中的this执行调用这个方法的数组)
    const result = original.apply(this, args)
    //获取这个数组的__ob__属性，也就是Observer实例(用于观测数据的)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift': //用于为数组添加元素
        inserted = args //缓存调用这个方法时传入参数,也就是想要添加的元素
        break
      case 'splice': //替换或删除数组项时
        inserted = args.slice(2) //获取替换的参数
        break
    }
    //如果存在inserted,则需要观测新添加的数据(如果新值为数组或对象)
    /*
      疑问: 这个时候数组必然是变化的,从而会去执行defineReactive中的set方法,重新观测这个数组,
      同时如果新添加的数据是对象或数组则必然也会被检测到，从而观测对象或数组,何必在这里多此一举
    */
    if (inserted) ob.observeArray(inserted)
    // notify change
    //执行依赖
    ob.dep.notify()
    //返回调用原数组方法该返回的值
    return result
  })
})
