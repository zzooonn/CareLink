# step2_preprocess_multilabel.py
# - 5개 superclass를 multi-hot(멀티라벨)로 생성
# - split은 StratifiedGroupKFold 한계 때문에 "primary label(대표 라벨)"로 stratify
# - 저장 y_train/y_val/y_test는 (N, 5) float32 multi-hot

import pandas as pd
import numpy as np
import ast
import os
from collections import Counter, defaultdict
from sklearn.model_selection import StratifiedGroupKFold

ALLOWED_CLASSES = ["NORM", "STTC", "MI", "CD", "HYP"]
CLASS_TO_IDX = {cls: i for i, cls in enumerate(ALLOWED_CLASSES)}

def preprocess_ptbxl_5class_multilabel():
    print("1. 데이터 로딩 중...")

    current_src_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_src_dir)
    interim_path = os.path.join(project_root, "data", "interim")

    path_X = os.path.join(interim_path, "ptbxl_X.npy")
    path_Y = os.path.join(interim_path, "ptbxl_Y.csv")

    X = np.load(path_X)  # (N,5000,12)
    Y = pd.read_csv(path_Y, index_col="seg_id")
    print(f"X shape: {X.shape}")

    print("2. 라벨링(멀티라벨) 생성 중...")
    Y.scp_codes = Y.scp_codes.apply(lambda x: ast.literal_eval(x))

    scp_path = os.path.join(project_root, "data", "raw", "ptbxl", "scp_statements.csv")
    scp_statements = pd.read_csv(scp_path, index_col=0)
    diag_statements = scp_statements[scp_statements["diagnostic"] == 1]

    def to_multihot_and_primary(scp_dict):
        """
        - diagnostic=1 코드만 사용
        - diagnostic_class가 5개 superclass 중 하나면 해당 클래스 1
        - primary label은 weight(score)가 가장 큰 superclass로 잡아서 stratify에 사용
        """
        scores = defaultdict(float)

        for code, w in scp_dict.items():
            if code in diag_statements.index:
                sup = diag_statements.loc[code, "diagnostic_class"]
                if sup in CLASS_TO_IDX:
                    # 점수 집계 방식:
                    # - 기존 코드와 비슷하게 "가장 강한 코드 기준(max)"을 유지
                    scores[sup] = max(scores[sup], float(w))

        if not scores:
            return None, None

        y_vec = np.zeros(len(ALLOWED_CLASSES), dtype=np.float32)
        for sup in scores.keys():
            y_vec[CLASS_TO_IDX[sup]] = 1.0

        primary = max(scores, key=scores.get)  # 대표 라벨(분할용)
        primary_idx = CLASS_TO_IDX[primary]
        return y_vec, primary_idx

    y_multi_list = []
    y_primary_list = []
    valid_idx = []

    for i, scp in enumerate(Y.scp_codes.values):
        y_vec, primary_idx = to_multihot_and_primary(scp)
        if y_vec is None:
            continue
        y_multi_list.append(y_vec)
        y_primary_list.append(primary_idx)
        valid_idx.append(i)

    valid_idx = np.array(valid_idx, dtype=np.int64)

    X = X[valid_idx]
    Y = Y.iloc[valid_idx].copy()
    y_multi = np.stack(y_multi_list, axis=0)      # (N,5)
    y_primary = np.array(y_primary_list)          # (N,)

    # 멀티라벨 분포 출력(각 클래스 positive 개수)
    pos_counts = y_multi.sum(axis=0).astype(int).tolist()
    print("멀티라벨 positive counts:", {ALLOWED_CLASSES[i]: pos_counts[i] for i in range(5)})
    print("primary label dist:", Counter(y_primary))

    # ---------------------------------------------------------
    # 3. 환자 단위 split (group 유지)
    #    - sklearn 제약: multilabel stratify 불가 → primary로 stratify
    # ---------------------------------------------------------
    print("\n3. Train/Val/Test 분할 (환자 단위 + primary stratified)...")

    groups = Y["patient_id"].values
    sgkf = StratifiedGroupKFold(n_splits=10, shuffle=True, random_state=42)
    folds = list(sgkf.split(X, y_primary, groups))

    _, test_idx = folds[0]
    _, val_idx  = folds[1]

    all_idx = np.arange(len(X))
    train_idx = np.setdiff1d(all_idx, np.concatenate([test_idx, val_idx]))

    X_train, y_train = X[train_idx], y_multi[train_idx]
    X_val,   y_val   = X[val_idx],   y_multi[val_idx]
    X_test,  y_test  = X[test_idx],  y_multi[test_idx]

    print("Train multi pos:", y_train.sum(axis=0).astype(int).tolist())
    print("Val   multi pos:", y_val.sum(axis=0).astype(int).tolist())
    print("Test  multi pos:", y_test.sum(axis=0).astype(int).tolist())

    return X_train, X_val, X_test, y_train, y_val, y_test

if __name__ == "__main__":
    result = preprocess_ptbxl_5class_multilabel()
    if result is not None:
        X_train, X_val, X_test, y_train, y_val, y_test = result

        current_src_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(current_src_dir)
        processed_path = os.path.join(project_root, "data", "processed")
        os.makedirs(processed_path, exist_ok=True)

        np.save(os.path.join(processed_path, "X_train.npy"), X_train)
        np.save(os.path.join(processed_path, "X_val.npy"),   X_val)
        np.save(os.path.join(processed_path, "X_test.npy"),  X_test)

        # ✅ y는 (N,5) multi-hot 저장
        np.save(os.path.join(processed_path, "y_train.npy"), y_train.astype(np.float32))
        np.save(os.path.join(processed_path, "y_val.npy"),   y_val.astype(np.float32))
        np.save(os.path.join(processed_path, "y_test.npy"),  y_test.astype(np.float32))

        print("\n최종 데이터 저장 완료! (멀티라벨)")
