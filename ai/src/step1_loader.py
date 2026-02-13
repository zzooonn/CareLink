# step1_loader.py (필터 제거 버전)

import pandas as pd
import numpy as np
import wfdb
import ast
import os

def load_ptbxl_segments(path, sampling_rate=500, segment_sec=10):
    if not os.path.exists(path):
        print(f"오류: '{path}' 경로를 찾을 수 없습니다.")
        return None, None

    csv_path = os.path.join(path, "ptbxl_database.csv")
    if not os.path.exists(csv_path):
        print(f"오류: '{csv_path}' 파일을 찾을 수 없습니다.")
        return None, None

    print(f"1. 메타 데이터 로딩 중... (경로: {csv_path})")
    Y_raw = pd.read_csv(csv_path, index_col="ecg_id")
    Y_raw.scp_codes = Y_raw.scp_codes.apply(lambda x: ast.literal_eval(x))

    # ✅ 여기서 미리 5클래스로 필터링하지 않음
    Y = Y_raw.copy()

    print(f"전체 레코드 수: {len(Y)}")

    X_list = []
    label_dict_list = []
    patient_list = []
    ecg_list = []

    seg_len = sampling_rate * segment_sec  # 500*10=5000
    print("2. 500Hz 파형 로딩 및 10초 세그먼트 분할 중...")

    for ecg_id, row in Y.iterrows():
        rec_path = os.path.join(path, row["filename_hr"])
        signal, meta = wfdb.rdsamp(rec_path)   # (T,12)
        signal = signal.astype(np.float32)

        T = signal.shape[0]
        n_segs = T // seg_len
        if n_segs == 0:
            continue

        for i in range(n_segs):
            seg = signal[i*seg_len:(i+1)*seg_len, :]  # (5000,12)
            X_list.append(seg)
            label_dict_list.append(row["scp_codes"])
            patient_list.append(row["patient_id"])
            ecg_list.append(ecg_id)

    X = np.stack(X_list, axis=0)  # (N,5000,12)
    print(f"세그먼트 개수: {X.shape[0]}, 형태: {X.shape}")

    Y_seg = pd.DataFrame({
        "scp_codes": [str(d) for d in label_dict_list],
        "patient_id": patient_list,
        "ecg_id": ecg_list,
    })
    Y_seg.index.name = "seg_id"

    return X, Y_seg

if __name__ == "__main__":
    current_src_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_src_dir)
    data_path = os.path.join(project_root, "data", "raw", "ptbxl")

    X, Y = load_ptbxl_segments(data_path, sampling_rate=500, segment_sec=10)

    if X is not None:
        interim_path = os.path.join(project_root, "data", "interim")
        os.makedirs(interim_path, exist_ok=True)

        np.save(os.path.join(interim_path, "ptbxl_X.npy"), X)
        Y.to_csv(os.path.join(interim_path, "ptbxl_Y.csv"))
        print("중간 데이터 저장 완료!")
    else:
        print("데이터 로딩 실패.")
