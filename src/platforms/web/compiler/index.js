/* @flow */

import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'

//编译器创建函数 生成包含(生成渲染函数内容的函数和生成渲染函数的函数)的对象
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
