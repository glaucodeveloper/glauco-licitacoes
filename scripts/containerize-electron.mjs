import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "dist", "container");
await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const dockerfile = `FROM node:24-alpine

ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

RUN addgroup -S glauco && adduser -S glauco -G glauco

COPY dist/renderer ./dist/renderer
COPY data ./data
COPY public ./public
COPY server ./server
COPY src/shared ./src/shared
COPY package.json ./package.json

RUN mkdir -p /tmp/glauco && chown -R glauco:glauco /app /tmp/glauco

USER glauco
EXPOSE 8080
CMD ["node", "server/container-server.mjs"]
`;

const dockerignore = [
  "node_modules",
  "dist/electron",
  "dist/packages",
  "*.log",
  ".git",
  ".ruby-lsp",
  ""
].join("\n");

const k8s = `apiVersion: v1
kind: Namespace
metadata:
  name: glauco
  labels:
    pod-security.kubernetes.io/enforce: restricted
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: glauco-licitacoes
  namespace: glauco
spec:
  replicas: 1
  selector:
    matchLabels:
      app: glauco-licitacoes
  template:
    metadata:
      labels:
        app: glauco-licitacoes
    spec:
      automountServiceAccountToken: false
      securityContext:
        runAsNonRoot: true
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: app
          image: glauco-licitacoes-electron:local
          ports:
            - containerPort: 8080
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: glauco-licitacoes
  namespace: glauco
spec:
  selector:
    app: glauco-licitacoes
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-by-default
  namespace: glauco
spec:
  podSelector: {}
  policyTypes: ["Ingress", "Egress"]
  ingress:
    - from:
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 443
`;

const ps1 = [
  "$ErrorActionPreference = 'Stop'",
  "docker build -f dist/container/Dockerfile -t glauco-licitacoes-electron:local .",
  "docker run --rm -p 8080:8080 --read-only --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp:rw,noexec,nosuid,size=64m glauco-licitacoes-electron:local",
  ""
].join("\n");

const bat = [
  "@echo off",
  "docker build -f dist/container/Dockerfile -t glauco-licitacoes-electron:local .",
  "docker run --rm -p 8080:8080 --read-only --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp:rw,noexec,nosuid,size=64m glauco-licitacoes-electron:local",
  ""
].join("\r\n");

await fs.writeFile(path.join(outDir, "Dockerfile"), dockerfile);
await fs.writeFile(path.join(outDir, ".dockerignore"), dockerignore);
await fs.writeFile(path.join(outDir, "kubernetes.yaml"), k8s);
await fs.writeFile(path.join(outDir, "run-container.ps1"), ps1);
await fs.writeFile(path.join(outDir, "run-container.bat"), bat);

console.log(`Dockerfile: ${path.join(outDir, "Dockerfile")}`);
console.log(`Kubernetes: ${path.join(outDir, "kubernetes.yaml")}`);
