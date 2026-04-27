/**
 * @fileoverview 国家代码到大洲的静态映射
 *
 * 本文件提供纯静态的国家代码到大洲映射，不依赖数据库。
 * 用于 infra 层的 IP 地理位置服务，避免 infra 依赖 domain。
 *
 * @module ip-geo/continent-mapping
 */
/**
 * 大洲类型
 */
export type Continent = 'as' | 'eu' | 'na' | 'sa' | 'af' | 'oc' | 'an';
/**
 * 大洲到国家代码的映射
 *
 * 数据来源：ISO 3166-1 alpha-2 国家代码
 */
export declare const CONTINENT_COUNTRIES: Record<Continent, string[]>;
/**
 * 国家代码到大洲的反向映射（运行时生成）
 */
export declare const COUNTRY_TO_CONTINENT: Record<string, Continent>;
/**
 * 根据国家代码获取大洲
 *
 * @param countryCode - ISO 3166-1 alpha-2 国家代码
 * @param defaultContinent - 默认大洲（找不到时返回）
 * @returns 大洲代码
 */
export declare function getContinentByCountry(countryCode: string, defaultContinent?: Continent): Continent;
