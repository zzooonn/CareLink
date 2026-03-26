# grad_cam_viz.py
# Grad-CAM 시각화 — CNN_CBAM_GRU / ResNet1D 공용
# 사용법:
#   python grad_cam_viz.py --model resnet   --classes 2 4   (MI, HYP 시각화)
#   python grad_cam_viz.py --model cnn_gru  --classes 0 1 2 3 4

import os
import argparse
import numpy as np
import torch
import matplotlib
matplotlib.use("Agg")           # 서버/headless 환경 대응
import matplotlib.pyplot as plt

from run_comparison import CNN_CBAM_GRU, ResNet1D, ECGDatasetMulti, LABELS


# =============================================================================
# 1) Grad-CAM 구현
# =============================================================================
class GradCAM1D:
    """
    임의의 1D-CNN 레이어에 Grad-CAM 적용.
    target_layer: forward hook을 걸 nn.Module (마지막 conv/block 권장)
    """
    def __init__(self, model: torch.nn.Module, target_layer: torch.nn.Module):
        self.model       = model
        self._acts       = None
        self._grads      = None
        self._fwd_handle = target_layer.register_forward_hook(self._save_acts)
        self._bwd_handle = target_layer.register_full_backward_hook(self._save_grads)

    def _save_acts(self, module, inp, out):
        self._acts = out.detach()

    def _save_grads(self, module, grad_in, grad_out):
        self._grads = grad_out[0].detach()

    def remove(self):
        self._fwd_handle.remove()
        self._bwd_handle.remove()

    def generate(self, x: torch.Tensor, amp: torch.Tensor, class_idx: int) -> np.ndarray:
        """
        Parameters
        ----------
        x         : (12, L) 단일 샘플 (batch 차원 없음)
        amp       : (36,)   amp 피처
        class_idx : 시각화할 클래스 인덱스

        Returns
        -------
        cam : (L,) numpy array, 0~1 정규화된 히트맵
        """
        # GRU backward는 train 모드 필요 (cudnn 제약)
        self.model.train()
        x_in   = x.unsqueeze(0)    # (1, 12, L)
        amp_in = amp.unsqueeze(0)  # (1, 36)

        logits = self.model(x_in, amp_in)       # (1, num_classes)
        self.model.zero_grad()
        logits[0, class_idx].backward()

        # GAP(Global Average Pooling) 방식으로 가중치 계산
        weights = self._grads.mean(dim=-1, keepdim=True)        # (1, C, 1)
        cam     = (weights * self._acts).sum(dim=1).squeeze(0)  # (T,)
        cam     = torch.relu(cam).cpu().numpy()

        if cam.max() > 0:
            cam /= cam.max()

        return cam


def get_target_layer(model):
    """모델 종류에 따라 Grad-CAM 대상 레이어 반환"""
    if isinstance(model, CNN_CBAM_GRU):
        return model.c3          # 마지막 ConvBlock
    elif isinstance(model, ResNet1D):
        return model.layer4[-1]  # 마지막 ResidualBlock
    else:
        raise ValueError(f"지원하지 않는 모델: {type(model)}")


# =============================================================================
# 2) 시각화 함수
# =============================================================================
LEAD_NAMES = ["I","II","III","aVR","aVL","aVF","V1","V2","V3","V4","V5","V6"]
LEAD_II    = 1   # 기본 표시 리드


def visualize_gradcam(model, dataset, device, save_dir,
                      n_samples=3, classes=None):
    """
    각 클래스별 n_samples 개 샘플에 대해 Grad-CAM 시각화 PNG 저장.

    Parameters
    ----------
    classes : list of int, 시각화할 클래스 인덱스 (None이면 전체 5개)
    """
    if classes is None:
        classes = list(range(len(LABELS)))

    os.makedirs(save_dir, exist_ok=True)
    target_layer = get_target_layer(model)
    gradcam      = GradCAM1D(model, target_layer)

    for class_idx in classes:
        class_name = LABELS[class_idx]

        # 해당 클래스 positive 샘플 인덱스 수집
        pos_idx = [i for i in range(len(dataset))
                   if dataset.y[i, class_idx] == 1.0]
        if not pos_idx:
            print(f"  [skip] {class_name} — positive 샘플 없음")
            continue

        rng = np.random.default_rng(seed=42)
        rng.shuffle(pos_idx)
        selected = pos_idx[:n_samples]

        fig, axes = plt.subplots(n_samples, 1,
                                 figsize=(16, 4 * n_samples),
                                 squeeze=False)

        for row, idx in enumerate(selected):
            ax = axes[row, 0]
            x, amp, y = dataset[idx]

            x_dev   = x.to(device)
            amp_dev = amp.to(device)
            cam     = gradcam.generate(x_dev, amp_dev, class_idx)

            # CAM을 원신호 길이(5000)에 맞게 선형 보간
            L          = x.shape[-1]
            cam_interp = np.interp(
                np.linspace(0, len(cam) - 1, L),
                np.arange(len(cam)), cam)

            t      = np.arange(L) / 500.0
            signal = x[LEAD_II].numpy()
            signal = (signal - signal.mean()) / (signal.std() + 1e-6)

            ax.plot(t, signal, color="black", linewidth=0.7, label=f"Lead {LEAD_NAMES[LEAD_II]}")

            # 히트맵 오버레이 (붉을수록 중요 구간)
            for j in range(L - 1):
                ax.axvspan(t[j], t[j + 1],
                           alpha=float(cam_interp[j]) * 0.45,
                           color="red", linewidth=0)

            true_labels = [LABELS[k] for k in range(5) if y[k] == 1.0]
            ax.set_title(
                f"{class_name} | Sample #{idx} | Ground Truth: {', '.join(true_labels)}",
                fontsize=11)
            ax.set_xlabel("Time (s)")
            ax.set_ylabel("Norm. Amplitude")
            ax.set_xlim([0, 10])
            ax.grid(True, alpha=0.3)
            ax.legend(loc="upper right", fontsize=9)

        model_tag = "ResNet1D" if isinstance(model, ResNet1D) else "CNN_CBAM_GRU"
        fig.suptitle(
            f"Grad-CAM Visualization — {class_name}  [{model_tag}]",
            fontsize=14, fontweight="bold")
        plt.tight_layout()

        save_path = os.path.join(save_dir, f"gradcam_{model_tag}_{class_name}.png")
        plt.savefig(save_path, dpi=150, bbox_inches="tight")
        plt.close(fig)
        print(f"  Saved: {save_path}")

    gradcam.remove()
    print("Grad-CAM 완료.")


# =============================================================================
# 3) Entry Point
# =============================================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Grad-CAM ECG Visualization")
    parser.add_argument("--model", choices=["cnn_gru", "resnet"], default="resnet",
                        help="사용할 모델 (best_resnet1d.pth 또는 best_cnn_gru.pth)")
    parser.add_argument("--classes", nargs="+", type=int, default=[0, 1, 2, 3, 4],
                        help="시각화할 클래스 인덱스 (0=NORM 1=STTC 2=MI 3=CD 4=HYP)")
    parser.add_argument("--n_samples", type=int, default=3,
                        help="클래스당 시각화 샘플 수")
    args = parser.parse_args()

    device  = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    src_dir = os.path.dirname(os.path.abspath(__file__))
    root    = os.path.dirname(src_dir)

    data_dir    = os.path.join(root, "data", "processed")
    models_dir  = os.path.join(root, "models")
    figures_dir = os.path.join(root, "figures", "gradcam")

    # 모델 로드
    if args.model == "resnet":
        model      = ResNet1D(num_classes=5).to(device)
        model_path = os.path.join(models_dir, "best_resnet1d.pth")
    else:
        model      = CNN_CBAM_GRU(num_classes=5, amp_dim=36).to(device)
        model_path = os.path.join(models_dir, "best_cnn_cbam_gru.pth")

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"모델 파일 없음: {model_path}\n먼저 train_local.py 학습을 완료하세요.")

    try:
        state = torch.load(model_path, map_location=device, weights_only=True)
    except TypeError:
        state = torch.load(model_path, map_location=device)
    # 체크포인트 키 이름 호환 처리 (shortcut ↔ skip)
    fixed = {}
    for k, v in state.items():
        fixed[k.replace(".shortcut.", ".skip.")] = v
    state = fixed
    model.load_state_dict(state)
    model.eval()
    print(f"Loaded: {model_path}")

    # 테스트 데이터셋 로드
    test_ds = ECGDatasetMulti(
        os.path.join(data_dir, "X_test.npy"),
        os.path.join(data_dir, "y_test.npy"),
        do_filter=True, augment=False)

    print(f"Generating Grad-CAM for [{args.model}]  classes={args.classes}  n={args.n_samples}")
    visualize_gradcam(model, test_ds, device, figures_dir,
                      n_samples=args.n_samples, classes=args.classes)
