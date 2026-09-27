package lru

import (
	"sync"
	"testing"
)

func TestLRU(t *testing.T) {
	c := New[string, int](3)
	c.Put("a", 1)
	c.Put("b", 2)
	c.Put("c", 3)
	if v, ok := c.Get("a"); !ok || v != 1 { t.Fatal("get a") }
	c.Put("d", 4)
	if _, ok := c.Get("b"); ok { t.Fatal("b should be evicted") }
	if v, ok := c.Get("c"); !ok || v != 3 { t.Fatal("get c") }
	if c.Len() != 3 { t.Fatalf("len=%d", c.Len()) }
	c.Delete("a")
	if c.Len() != 2 { t.Fatalf("len=%d", c.Len()) }
	if _, ok := c.Get("a"); ok { t.Fatal("a should be deleted") }
}

func TestConcurrent(t *testing.T) {
	c := New[int, int](100)
	var wg sync.WaitGroup
	for g := 0; g < 10; g++ {
		wg.Add(1)
		go func(offset int) {
			defer wg.Done()
			for i := 0; i < 100; i++ {
				k := offset*100+i
				c.Put(k, i)
				c.Get(k)
			}
		}(g)
	}
	wg.Wait()
}
