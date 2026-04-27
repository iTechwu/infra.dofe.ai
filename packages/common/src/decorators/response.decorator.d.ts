import { Type } from '@nestjs/common';
/**
 * 封装 swagger 返回统一结构
 * 支持复杂类型 { code, msg, data }
 * @param model 返回的 data 的数据类型
 * @param isArray data 是否是数组
 * @param isPager 设置为 true, 则 data 类型为 { list, total } , false data 类型是纯数组
 */
export declare const ApiResponse: <TModel extends Type<any>>(model?: TModel, isArray?: boolean, isPager?: boolean) => <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
