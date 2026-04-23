import { supabase } from '../lib/supabase';

export const todoService = {
  async getTodos() {
    const { data, error } = await supabase
      .from('todo_items')
      .select('*')
      .order('completed', { ascending: true })
      .order('due_date', { ascending: true })
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async addTodo(todo) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('todo_items')
      .insert([{ ...todo, user_id: user.id }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateTodo(id, updates) {
    const { data, error } = await supabase
      .from('todo_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteTodo(id) {
    const { error } = await supabase
      .from('todo_items')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async toggleComplete(id, completed) {
    const status = completed ? 'Hoàn thành' : 'Chưa làm';
    const { data, error } = await supabase
      .from('todo_items')
      .update({ completed, status })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};
