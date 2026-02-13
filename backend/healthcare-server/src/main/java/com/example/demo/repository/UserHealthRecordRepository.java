    package com.example.demo.repository;

    import com.example.demo.entity.UserHealthRecord;
    import org.springframework.data.jpa.repository.JpaRepository;
    import org.springframework.data.jpa.repository.Query;
    import org.springframework.data.repository.query.Param;
    import java.util.List;
    import java.time.LocalDateTime;
    import java.util.Optional;

    public interface UserHealthRecordRepository extends JpaRepository<UserHealthRecord, Long> {

        // ✅ 유저 PK(id) 기준으로 최신 1건
        Optional<UserHealthRecord> findTopByUser_IdOrderByMeasuredAtDesc(Long userPkId);

        // (원하면 리스트도)
        List<UserHealthRecord> findByUser_IdOrderByMeasuredAtDesc(Long userPkId);

        @Query("SELECT AVG(r.bpSys), AVG(r.bpDia) FROM UserHealthRecord r " +
                "WHERE r.user.id = :userId AND r.bpSys IS NOT NULL AND r.bpDia IS NOT NULL")
        List<Object[]> findAverageBpByUserId(@Param("userId") Long userId);

        @Query("SELECT AVG(r.glucose) FROM UserHealthRecord r WHERE r.user.id = :userId AND r.glucose IS NOT NULL")
        Double findAverageGlucoseByUserId(@Param("userId") Long userId);

        List<UserHealthRecord> findByUser_IdAndMeasuredAtBetweenOrderByMeasuredAtAsc(
            Long userPkId,
            LocalDateTime start,
            LocalDateTime end
        );

    }
