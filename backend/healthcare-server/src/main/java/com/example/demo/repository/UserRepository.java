package com.example.demo.repository;
import com.example.demo.entity.User;
import com.example.demo.entity.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUserId(String userId);

    boolean existsByUserId(String userId);
    List<User> findByRole(UserRole role);
    List<User> findByNameAndRole(String name, UserRole role);

    Optional<User> findByUserIdAndBirthDate(String userId, LocalDate birthDate);
    List<User> findByNameIgnoreCaseAndBirthDate(String name, LocalDate birthDate);
    Optional<User> findByNameIgnoreCaseAndBirthDateAndPhone(String name, LocalDate birthDate, String phone);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update User u set u.expoPushToken = null where u.expoPushToken = :token")
    int clearExpoPushToken(@Param("token") String token);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update User u set u.expoPushToken = null where u.expoPushToken = :token and u.userId <> :userId")
    int clearExpoPushTokenExceptUser(@Param("token") String token, @Param("userId") String userId);
}