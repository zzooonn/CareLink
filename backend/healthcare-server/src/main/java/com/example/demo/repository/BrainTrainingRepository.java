package com.example.demo.repository;

import com.example.demo.entity.BrainTrainingGame;
import com.example.demo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BrainTrainingRepository extends JpaRepository<BrainTrainingGame, Long> {

    List<BrainTrainingGame> findByUserOrderByCreatedAtDesc(User user);

    @Query("SELECT MAX(b.score) FROM BrainTrainingGame b WHERE b.user = :user")
    Optional<Long> findBestScoreByUser(@Param("user") User user);
}
