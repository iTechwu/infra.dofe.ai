import { PipeTransform, ArgumentMetadata } from '@nestjs/common';
export declare class TransformRootPipe implements PipeTransform {
    transform(value: any, _metadata: ArgumentMetadata): any;
}
