import torch
from torch.utils.data import DataLoader
import matplotlib.pyplot as plt
import os
import numpy as np

# 1. 경로 및 데이터셋 설정 (로컬 PC 경로로 수정)
# --------------------------------------------------------------------------------------
# ⚠️ 로컬 경로로 변경 (Windows 경로 방식 사용)
# project_root는 'data'와 'models' 폴더를 포함하는 최상위 폴더여야 합니다.
project_root = r'C:\Users\zoon\Desktop\HealthCare\ai'  # r''을 사용하여 역슬래시(\)를 이스케이프하지 않도록 합니다.
# --------------------------------------------------------------------------------------

processed_path = os.path.join(project_root, 'data', 'processed')

print(f"데이터 경로 확인: {processed_path}")

# 2. 데이터셋 및 로더 생성 (시각화를 위해 잠시 생성)
# 주의: 이 코드를 실행하기 전에, 이전에 제공된 'ECGDataset' 클래스 정의가
# 같은 파이썬 세션(예: IPython 또는 전체 스크립트의 상단)에 정의되어 있어야 합니다.
if 'ECGDataset' not in globals():
    print("❌ 오류: 'ECGDataset' 클래스가 정의되지 않았습니다. 모델과 Dataset 클래스 정의 전체를 먼저 실행하거나 같은 파일에 넣어주세요!")
else:
    # 훈련 데이터만 로드 (시각화용)
    try:
        # ⚠️ FileNotFoundError가 발생하면 'processed' 폴더 안에 X_train.npy, y_train.npy 파일이 있는지 확인해 주세요.
        train_dataset = ECGDataset(
            os.path.join(processed_path, 'X_train.npy'),
            os.path.join(processed_path, 'y_train.npy'),
            augment=False, # 시각화할 때는 원본을 보기 위해 증강 끔
            fs=100,
            do_filter=True
        )
        
        # 시각화용 로더 (배치 사이즈 1로 설정하여 하나씩 확인)
        viz_loader = DataLoader(train_dataset, batch_size=1, shuffle=True)
        print("✅ 데이터 로드 성공! 시각화를 시작합니다.")
        
        # 3. 시각화 함수 정의 및 실행
        def visualize_ecg_sample(loader):
            data_iter = iter(loader)
            inputs, labels = next(data_iter)
            
            # (Batch, 12, 1000) -> (12, 1000)
            sample_ecg = inputs[0].cpu().numpy()
            label = labels[0].item()
            
            # 라벨 이름 매핑 (MIT-BIH 기준: N, S, V, F, Q)
            label_map = {0: 'Normal (N)', 1: 'S-Ectopic (S)', 2: 'V-Ectopic (V)', 3: 'Fusion (F)', 4: 'Unknown (Q)'}
            label_name = label_map.get(label, str(label))

            print(f"\n--- 샘플 정보 ---")
            print(f"Label: {label} ({label_name})")
            print(f"Shape: {sample_ecg.shape}")
            print(f"Min: {sample_ecg.min():.4f}, Max: {sample_ecg.max():.4f}")
            
            # 주요 리드 시각화
            plt.figure(figsize=(15, 6))
            # 12개 채널 중 3개만 그려서 확인
            leads_to_plot = [0, 1, 6] # 예시 채널
            
            for i, lead_idx in enumerate(leads_to_plot):
                if lead_idx < sample_ecg.shape[0]:
                    # 겹치지 않게 y축으로 띄워서 그리기
                    plt.plot(sample_ecg[lead_idx] + i*4, label=f'Channel {lead_idx}')
            
            plt.title(f"ECG Sample Visualization - Label: {label_name}")
            plt.xlabel("Time Steps (Samples)")
            plt.ylabel("Amplitude (Normalized & Offset)")
            plt.legend()
            plt.grid(True, alpha=0.3)
            plt.show()

        # 함수 실행
        visualize_ecg_sample(viz_loader)

    except FileNotFoundError:
        # 이 오류가 발생하면 processed 폴더 내 파일명(X_train.npy 등)을 확인해야 합니다.
        print(f"❌ 파일을 찾을 수 없습니다. 다음 경로와 파일명을 확인하세요: {processed_path}")