package repository

import "errors"

var (
	// ErrAnotherQuizInProgress означает, что уже есть другая викторина в статусе in_progress.
	ErrAnotherQuizInProgress = errors.New("another quiz is already in progress")
	// ErrQuizNotScheduled означает, что запрошенная викторина не находится в статусе scheduled.
	ErrQuizNotScheduled = errors.New("quiz is not scheduled")
)

