package com.example.demo.repository;

import com.example.demo.dto.NotificationResponseDto;
import com.example.demo.entity.User;
import com.example.demo.entity.UserHealthAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserHealthAlertRepository extends JpaRepository<UserHealthAlert, Long> {
    // 특정 유저(환자든 보호자든)가 받은 알림 목록 조회
    List<UserHealthAlert> findByReceiverOrderByCreatedAtDesc(User receiver);

    @Query("""
            select new com.example.demo.dto.NotificationResponseDto(
                a.id,
                a.title,
                a.message,
                a.alertType,
                p.userId,
                a.createdAt,
                case when a.readAt is not null then true else false end
            )
            from UserHealthAlert a
            left join a.patient p
            where a.receiver = :receiver
            order by a.createdAt desc
            """)
    List<NotificationResponseDto> findNotificationResponsesByReceiver(@Param("receiver") User receiver);
}
