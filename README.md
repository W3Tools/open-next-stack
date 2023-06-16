# open-next-stack

### 1. Copy the example as [.env](./.env) and change your configuration

```bash
cp env.example .env
```

### 2. To start for the first time, Please run the bootstrap

```bash
yarn bootstrap ${YOUR_PROFILE_NAME}
```

### 2.1 Add your project information in [item_config.ts](./item_config.ts)

### 2.2 Add your domain information and host zone information in [ACM_config.ts](./ACM_config.ts)

### 3. deploy

```bash
yarn deploy ${YOUR_PROFILE_NAME}
```

### How to Start?

-   ### install depend
    ```
    yarn install
    ```
-   ### Enable yarn3 in vscode
    ```
    yarn dlx @yarnpkg/sdks vscode
    ```
