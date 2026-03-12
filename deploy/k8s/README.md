# CareLink Kubernetes 샘플 매니페스트

이 폴더는 **Docker Compose 안정화 후** 넘어갈 수 있는 최소 K8s 예시입니다.

## 적용 순서

```bash
kubectl apply -f namespace.yaml
kubectl apply -f secret.example.yaml
kubectl apply -f postgres.yaml
kubectl apply -f backend.yaml
kubectl apply -f ai.yaml
```

> `secret.example.yaml`은 예시이므로 실제 값으로 수정한 뒤 적용하세요.
