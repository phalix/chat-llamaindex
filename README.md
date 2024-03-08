# Docker Container for Dedicated (On-Premise) LLM with RAG Hosting in Local Datacenters

Embark on a seamless journey of on-premise LLM (Large Language Model) deployment empowered by RAG (Retrieval-Augmented Generation) within your local data centers. Utilize Docker containers to encapsulate this powerful fusion, ensuring robust performance and enhanced accessibility.

Begin by initiating the creation of your custom Docker image with the command `docker build .`. This image harmonizes with the ecosystems of [Qdrant](https://qdrant.tech/) and [Ollama](https://ollama.com/), forming an integrated solution for unparalleled linguistic prowess.

Configure connections and permissible models effortlessly, tailoring the environment to your specific needs:

- **Ollama Models Configuration:**
  - `ollamamodel1=gemma:2b`
  - `ollamamodel2=gemma:7b`
  - `ollamamodel3=mistral`

- **Base URLs Configuration:**
  - Ollama Base URL: `http://localhost:11434`
  - Qdrant Base URL: `http://localhost:6333`

Upon configuration, Docker Compose stands ready to orchestrate your deployment with utmost efficiency. Should further guidance or customization be required, Docker Compose can be readily provided upon request, ensuring your journey with on-premise LLM and RAG hosting is nothing short of exceptional.

This repository is based on [llamaindexts](https://ts.llamaindex.ai/) and the fantastic demo [chat.llamaindex](https://chat.llamaindex.ai/)