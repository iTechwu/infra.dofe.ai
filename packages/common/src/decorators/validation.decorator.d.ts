export declare function LengthValidator(min: number, max: number, errorTypeMin: string, errorTypeMax: string, field?: string, validateErrorType?: string): (object: object, propertyName: string) => void;
export declare function IsDateFormat(field: string, canbeNull?: boolean, errorType?: string): (object: object, propertyName: string) => void;
export declare function IsUUIDFormat(field: string, canbeNull?: boolean, errorType?: string): (object: object, propertyName: string) => void;
