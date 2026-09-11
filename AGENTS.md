# AGENTS.md

## Shared Deployment Infrastructure

- In every deployment change, Dockerfiles and Docker Compose files must not create, run, or embed PostgreSQL, Redis, or RabbitMQ services.
- Do not add service definitions, images, containers, initialization jobs, or persistent volumes for these dependencies.
- PostgreSQL, Redis, and RabbitMQ are centrally managed by `../docker-helm.dofe.ai`; application deployments must connect to those externally managed services through configuration.

