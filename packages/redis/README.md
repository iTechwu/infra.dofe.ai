# @dofe/infra-redis

Redis primitives for Dofe services.

## Owns

- Redis module/service wrappers.
- Cache and tenant cache helpers.
- Distributed lock primitives.
- Redis version checks and BullMQ bootstrap option helpers.

## Does Not Own

- Product queue names, processors, worker lifecycles, or QueueModule
  registration rules.
- Product lock-key semantics such as Loop issue locks or Bot trigger locks.
- Business data serialization policy.

Consumers keep queue registration and processor ownership local while delegating
Redis/BullMQ bootstrap mechanics here.
